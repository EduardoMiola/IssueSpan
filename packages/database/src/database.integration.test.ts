import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { createDatabaseClient } from "./client.js";
import { TenantAccessDeniedError, withTenantTransaction, withUserTransaction } from "./tenant-transaction.js";

config({ path: "../../.env" });

const adminUrl = process.env.DATABASE_TEST_URL ?? process.env.DATABASE_URL;
if (!adminUrl) throw new Error("DATABASE_TEST_URL or DATABASE_URL is required");

function runtimeUrl(url: string) {
  const parsed = new URL(url);
  parsed.username = "issuespan_app";
  parsed.password = "issuespan-app-local-only";
  return parsed.toString();
}

const tenantA = "00000000-0000-7000-8000-000000000001";
const tenantB = "00000000-0000-7000-8000-000000000002";
const userA = "00000000-0000-7000-8000-000000000011";
const userB = "00000000-0000-7000-8000-000000000012";
const accountA = "00000000-0000-7000-8000-000000000021";
const accountB = "00000000-0000-7000-8000-000000000022";
const conversationA = "00000000-0000-7000-8000-000000000031";
const conversationB = "00000000-0000-7000-8000-000000000032";

describe("PostgreSQL 18 tenancy foundation", () => {
  const admin = new Pool({ connectionString: adminUrl });
  const runtime = new Pool({ connectionString: runtimeUrl(adminUrl) });

  beforeAll(async () => {
    await admin.query("TRUNCATE outbox_events, messages, conversations, contacts, customer_accounts, memberships, sessions, users, organizations CASCADE");
    await admin.query("INSERT INTO organizations (id, slug, name) VALUES ($1, 'tenant-a', 'Tenant A'), ($2, 'tenant-b', 'Tenant B')", [tenantA, tenantB]);
    await admin.query("INSERT INTO users (id, email) VALUES ($1, 'user-a@example.test'), ($2, 'user-b@example.test')", [userA, userB]);
    await admin.query("INSERT INTO memberships (organization_id, user_id, role) VALUES ($1, $3, 'OWNER'), ($2, $3, 'AGENT')", [tenantA, tenantB, userA]);
    await admin.query("INSERT INTO customer_accounts (id, organization_id, name) VALUES ($1, $3, 'Account A'), ($2, $4, 'Account B')", [accountA, accountB, tenantA, tenantB]);
    await admin.query("INSERT INTO conversations (id, organization_id, status) VALUES ($1, $3, 'OPEN'), ($2, $4, 'OPEN')", [conversationA, conversationB, tenantA, tenantB]);
  });

  afterAll(async () => {
    await runtime.end();
    await admin.end();
  });

  it("uses a non-superuser, non-BYPASSRLS runtime role that owns no protected table", async () => {
    const result = await runtime.query(`
      SELECT r.rolsuper, r.rolbypassrls,
        EXISTS (SELECT 1 FROM pg_class c WHERE c.relowner = r.oid AND c.relname IN ('memberships','customer_accounts','contacts','conversations','messages','outbox_events')) AS owns_protected_table
      FROM pg_roles r WHERE r.rolname = current_user
    `);
    expect(result.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false, owns_protected_table: false });
  });

  it("fails closed without tenant context and isolates known foreign IDs", async () => {
    expect((await runtime.query("SELECT count(*)::int AS count FROM customer_accounts")).rows[0].count).toBe(0);
    await expect(runtime.query("INSERT INTO customer_accounts (organization_id, name) VALUES ($1, 'missing context')", [tenantA])).rejects.toThrow();
    await runtime.query("SELECT set_config('app.organization_id', $1, false)", [tenantA]);
    expect((await runtime.query("SELECT id FROM customer_accounts WHERE id = $1", [accountA])).rowCount).toBe(1);
    expect((await runtime.query("SELECT id FROM customer_accounts WHERE id = $1", [accountB])).rowCount).toBe(0);
    await expect(runtime.query("INSERT INTO customer_accounts (organization_id, name) VALUES ($1, 'wrong tenant')", [tenantB])).rejects.toThrow();
  });

  it("enforces composite tenant foreign keys even with a known foreign conversation UUID", async () => {
    await runtime.query("BEGIN");
    await runtime.query("SELECT set_config('app.organization_id', $1, true)", [tenantA]);
    await expect(runtime.query("INSERT INTO messages (organization_id, conversation_id, direction, content) VALUES ($1, $2, 'INBOUND', 'fixture')", [tenantA, conversationB])).rejects.toThrow();
    await runtime.query("ROLLBACK");
  });

  it("enforces tenant-scoped membership uniqueness", async () => {
    await expect(admin.query("INSERT INTO memberships (organization_id, user_id, role) VALUES ($1, $2, 'ADMIN')", [tenantA, userA])).rejects.toThrow();
  });

  it("cleans up transaction-local context and uses READ COMMITTED", async () => {
    const connection = await runtime.connect();
    try {
      await connection.query("BEGIN");
      await connection.query("SELECT set_config('app.organization_id', $1, true)", [tenantA]);
      expect((await connection.query("SELECT current_setting('transaction_isolation') AS isolation")).rows[0].isolation).toBe("read committed");
      await connection.query("COMMIT");
      expect((await connection.query("SELECT count(*)::int AS count FROM customer_accounts")).rows[0].count).toBe(0);
    } finally {
      connection.release();
    }
  });

  it("commits an outbox event atomically with its tenant transaction", async () => {
    const client = createDatabaseClient(runtimeUrl(adminUrl));
    await withTenantTransaction(client, { organizationId: tenantA, userId: userA }, async (tx) => {
      await tx.$executeRaw`INSERT INTO conversations (organization_id, status) VALUES (${tenantA}::uuid, 'OPEN')`;
      await tx.$executeRaw`INSERT INTO outbox_events (organization_id, event_type, aggregate_type, aggregate_id, payload) VALUES (${tenantA}::uuid, 'ConversationOpened', 'Conversation', uuidv7(), '{}'::jsonb)`;
    });
    const counts = await admin.query("SELECT (SELECT count(*) FROM outbox_events WHERE organization_id = $1)::int AS outbox, (SELECT count(*) FROM conversations WHERE organization_id = $1)::int AS conversations", [tenantA]);
    expect(counts.rows[0]).toEqual({ outbox: 1, conversations: 2 });
    await client.$disconnect();
  });

  it("proves membership before exposing a tenant transaction", async () => {
    const client = createDatabaseClient(runtimeUrl(adminUrl));
    try {
      const proof = await withTenantTransaction(
        client,
        { organizationId: tenantA, userId: userA },
        async (transaction, context) => ({
          context,
          visibleOrganizations: (
            await transaction.membership.findMany({ select: { organizationId: true } })
          ).map(({ organizationId }) => organizationId),
        }),
      );
      expect(proof.context).toMatchObject({
        organizationId: tenantA,
        userId: userA,
        role: "OWNER",
      });
      expect(proof.visibleOrganizations).toEqual([tenantA]);

      const deniedContext = withTenantTransaction(
        client,
        { organizationId: tenantA, userId: userB },
        async () => "must not run",
      );
      await expect(deniedContext).rejects.toBeInstanceOf(TenantAccessDeniedError);

      let callbackWasCalled = false;
      const missingContext = withTenantTransaction(client, undefined, async () => {
        callbackWasCalled = true;
      });
      await expect(missingContext).rejects.toBeInstanceOf(TenantAccessDeniedError);
      expect(callbackWasCalled).toBe(false);
    } finally {
      await client.$disconnect();
    }
  });

  it("locks the Membership proof against role changes until tenant work completes", async () => {
    const client = createDatabaseClient(runtimeUrl(adminUrl));
    try {
      await withTenantTransaction(
        client,
        { organizationId: tenantA, userId: userA },
        async () => {
          const revoker = await admin.connect();
          try {
            await revoker.query("BEGIN");
            try {
              await revoker.query("SET LOCAL lock_timeout = '100ms'");
              const roleChange = revoker.query(
                "UPDATE memberships SET role = 'AGENT' WHERE organization_id = $1 AND user_id = $2",
                [tenantA, userA],
              );
              await expect(roleChange).rejects.toMatchObject({ code: "55P03" });
            } finally {
              await revoker.query("ROLLBACK");
            }
          } finally {
            revoker.release();
          }
        },
      );
    } finally {
      await client.$disconnect();
    }
  });

  it("keeps authenticated user scope read-only and limited to that user's memberships", async () => {
    const client = createDatabaseClient(runtimeUrl(adminUrl));
    try {
      const memberships = await withUserTransaction(client, userA, (transaction) => (
        transaction.membership.findMany({
          select: { userId: true, organizationId: true },
        })
      ));
      expect(memberships).toHaveLength(2);
      expect(memberships.every(({ userId }) => userId === userA)).toBe(true);

      const deletion = await withUserTransaction(client, userA, (transaction) => (
        transaction.membership.deleteMany({ where: { userId: userA } })
      ));
      expect(deletion.count).toBe(0);

      const persisted = await admin.query(
        "SELECT count(*)::int AS count FROM memberships WHERE user_id = $1",
        [userA],
      );
      expect(persisted.rows[0].count).toBe(2);
    } finally {
      await client.$disconnect();
    }
  });

  it("generates UUIDv7 identifiers", async () => {
    const result = await admin.query("SELECT uuidv7()::text AS id");
    expect(result.rows[0].id[14]).toBe("7");
  });
});
