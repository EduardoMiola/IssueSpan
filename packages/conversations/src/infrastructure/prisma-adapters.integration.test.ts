import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "@issuespan/database";
import { createPrismaConversationRepositories } from "./prisma-adapters.js";
import type { TenantContext } from "../contracts.js";

config({ path: "../../../.env" });

const adminUrl = process.env.DATABASE_TEST_URL ?? process.env.DATABASE_URL;
const runtimeUrl = adminUrl ? withRuntimeCredentials(adminUrl) : undefined;
const integration = describe.skipIf(!adminUrl);
const tenantA: TenantContext = { organizationId: "00000000-0000-7000-8000-000000000101", userId: "00000000-0000-7000-8000-000000000111", membershipId: "00000000-0000-7000-8000-000000000121", role: "OWNER" };
const tenantB = "00000000-0000-7000-8000-000000000102";
const conversationA = "00000000-0000-7000-8000-000000000131";
const conversationB = "00000000-0000-7000-8000-000000000132";

integration("Prisma conversation adapter", () => {
  const admin = adminUrl ? createDatabaseClient(adminUrl) : undefined;
  const runtime = runtimeUrl ? createDatabaseClient(runtimeUrl) : undefined;

  beforeAll(async () => {
    if (!admin) return;
    await admin.$executeRawUnsafe("TRUNCATE outbox_events, messages, conversations, contacts, customer_accounts, memberships, sessions, users, organizations CASCADE");
    await admin.$executeRawUnsafe("INSERT INTO organizations (id, slug, name) VALUES ($1::uuid, 'conversation-a', 'Conversation A'), ($2::uuid, 'conversation-b', 'Conversation B')", tenantA.organizationId, tenantB);
    await admin.$executeRawUnsafe("INSERT INTO users (id, email) VALUES ($1::uuid, 'conversation-user@example.test')", tenantA.userId);
    await admin.$executeRawUnsafe("INSERT INTO memberships (id, organization_id, user_id, role) VALUES ($1::uuid, $2::uuid, $3::uuid, 'OWNER')", tenantA.membershipId, tenantA.organizationId, tenantA.userId);
    await admin.$executeRawUnsafe("INSERT INTO conversations (id, organization_id, status) VALUES ($1::uuid, $2::uuid, 'OPEN'), ($3::uuid, $4::uuid, 'OPEN')", conversationA, tenantA.organizationId, conversationB, tenantB);
  });

  afterAll(async () => {
    await runtime?.$disconnect();
    await admin?.$disconnect();
  });

  it("reads only conversations inside the proven TenantContext", async () => {
    const repositories = createPrismaConversationRepositories(runtime!);
    await expect(repositories.conversations.findById(tenantA, conversationA)).resolves.toMatchObject({ id: conversationA, organizationId: tenantA.organizationId });
    await expect(repositories.conversations.findById(tenantA, conversationB)).resolves.toBeNull();
  });
});

function withRuntimeCredentials(url: string): string {
  const parsed = new URL(url);
  parsed.username = "issuespan_app";
  parsed.password = "issuespan-app-local-only";
  return parsed.toString();
}
