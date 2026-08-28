import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient, TenantAccessDeniedError } from "@issuespan/database";
import { ConversationApplicationService } from "../application.js";
import { createPrismaConversationRepositories } from "./prisma-adapters.js";
import type { TenantContext } from "../contracts.js";
import type { ConversationSnapshot } from "../domain.js";

config({ path: fileURLToPath(new URL("../../../../.env", import.meta.url)) });

const adminUrl = resolveTestDatabaseUrl(
  process.env.DATABASE_TEST_URL,
  process.env.DATABASE_URL,
  process.env.CI === "true" && process.env.GITHUB_ACTIONS === "true",
);
const runtimeUrl = adminUrl ? withRuntimeCredentials(adminUrl) : undefined;
const integration = describe.skipIf(!adminUrl);
const tenantA: TenantContext = {
  organizationId: "00000000-0000-7000-8000-000000000101",
  userId: "00000000-0000-7000-8000-000000000111",
  membershipId: "00000000-0000-7000-8000-000000000121",
  role: "OWNER",
};
const tenantB = "00000000-0000-7000-8000-000000000102";
const conversationA = "00000000-0000-7000-8000-000000000131";
const conversationB = "00000000-0000-7000-8000-000000000132";
const messageB = "00000000-0000-7000-8000-000000000141";

describe("integration database safety", () => {
  it("requires an explicitly named test database outside ephemeral GitHub Actions", () => {
    expect(() =>
      resolveTestDatabaseUrl(
        "postgresql://user:password@localhost:5432/issuespan",
        undefined,
        false,
      ),
    ).toThrow(/dedicated test database/);

    expect(
      resolveTestDatabaseUrl(
        "postgresql://user:password@localhost:5432/issuespan_test",
        undefined,
        false,
      ),
    ).toBe("postgresql://user:password@localhost:5432/issuespan_test");

    expect(() =>
      resolveTestDatabaseUrl("https://localhost/issuespan_test", undefined, false),
    ).toThrow(/PostgreSQL URL/);
  });

  it("allows the ephemeral localhost database provisioned by GitHub Actions", () => {
    expect(
      resolveTestDatabaseUrl(
        "postgresql://user:password@localhost:5432/issuespan",
        "postgresql://user:password@localhost:5432/issuespan",
        true,
      ),
    ).toBe("postgresql://user:password@localhost:5432/issuespan");
  });
});

integration("Prisma conversation adapter", () => {
  const admin = adminUrl ? createDatabaseClient(adminUrl) : undefined;
  const runtime = runtimeUrl ? createDatabaseClient(runtimeUrl) : undefined;

  beforeEach(async () => {
    if (!admin) return;
    await admin.$executeRawUnsafe(
      "TRUNCATE outbox_events, messages, conversations, contacts, customer_accounts, memberships, sessions, users, organizations CASCADE",
    );
    await admin.$executeRawUnsafe(
      "INSERT INTO organizations (id, slug, name) VALUES ($1::uuid, 'conversation-a', 'Conversation A'), ($2::uuid, 'conversation-b', 'Conversation B')",
      tenantA.organizationId,
      tenantB,
    );
    await admin.$executeRawUnsafe(
      "INSERT INTO users (id, email) VALUES ($1::uuid, 'conversation-user@example.test')",
      tenantA.userId,
    );
    await admin.$executeRawUnsafe(
      "INSERT INTO memberships (id, organization_id, user_id, role) VALUES ($1::uuid, $2::uuid, $3::uuid, 'OWNER')",
      tenantA.membershipId,
      tenantA.organizationId,
      tenantA.userId,
    );
    await admin.$executeRawUnsafe(
      "INSERT INTO conversations (id, organization_id, status) VALUES ($1::uuid, $2::uuid, 'OPEN'), ($3::uuid, $4::uuid, 'OPEN')",
      conversationA,
      tenantA.organizationId,
      conversationB,
      tenantB,
    );
    await admin.$executeRawUnsafe(
      "INSERT INTO messages (id, organization_id, conversation_id, direction, content) VALUES ($1::uuid, $2::uuid, $3::uuid, 'INBOUND', 'foreign message')",
      messageB,
      tenantB,
      conversationB,
    );
  });

  afterAll(async () => {
    await runtime?.$disconnect();
    await admin?.$disconnect();
  });

  it("reads only conversations inside the proven TenantContext", async () => {
    const persistence = createPrismaConversationRepositories(runtime!);

    await persistence.withTenantTransaction(tenantA, async (repositories) => {
      await expect(repositories.conversations.findById(conversationA)).resolves.toMatchObject({
        id: conversationA,
        organizationId: tenantA.organizationId,
      });
      await expect(repositories.conversations.findById(conversationB)).resolves.toBeNull();
    });
  });

  it("cannot mutate a known foreign conversation", async () => {
    const persistence = createPrismaConversationRepositories(runtime!);
    const foreignSnapshot = conversationSnapshot({
      id: conversationB,
      organizationId: tenantA.organizationId,
      status: "RESOLVED",
    });

    await expect(
      persistence.withTenantTransaction(tenantA, (repositories) =>
        repositories.conversations.save(foreignSnapshot),
      ),
    ).rejects.toThrow();

    await expect(
      admin!.conversation.findUniqueOrThrow({ where: { id: conversationB } }),
    ).resolves.toMatchObject({ status: "OPEN", organizationId: tenantB });
  });

  it("cannot attach a message to a known foreign conversation", async () => {
    const persistence = createPrismaConversationRepositories(runtime!);
    const attemptedMessageId = "00000000-0000-7000-8000-000000000142";

    await expect(
      persistence.withTenantTransaction(tenantA, (repositories) =>
        repositories.messages.add({
          id: attemptedMessageId,
          organizationId: tenantA.organizationId,
          conversationId: conversationB,
          direction: "INBOUND",
          content: "must not attach",
          createdAt: new Date("2026-08-26T12:05:00.000Z"),
        }),
      ),
    ).rejects.toThrow();

    await expect(admin!.message.findUnique({ where: { id: attemptedMessageId } })).resolves.toBeNull();
  });

  it("cannot read a known foreign message or transcript", async () => {
    const persistence = createPrismaConversationRepositories(runtime!);

    await persistence.withTenantTransaction(tenantA, async (repositories) => {
      await expect(repositories.messages.findById(messageB)).resolves.toBeNull();
      await expect(repositories.messages.listByConversation(conversationB)).resolves.toEqual([]);
    });
  });

  it("fails closed before database access when TenantContext is missing", async () => {
    const persistence = createPrismaConversationRepositories(runtime!);

    await expect(
      persistence.withTenantTransaction(undefined, async () => undefined),
    ).rejects.toBeInstanceOf(TenantAccessDeniedError);
  });

  it("rolls back message insertion when conversation save fails", async () => {
    const persistence = createPrismaConversationRepositories(runtime!);
    const attemptedMessageId = "00000000-0000-7000-8000-000000000143";

    await expect(
      persistence.withTenantTransaction(tenantA, async (repositories) => {
        await repositories.messages.add({
          id: attemptedMessageId,
          organizationId: tenantA.organizationId,
          conversationId: conversationA,
          direction: "INBOUND",
          content: "roll me back",
          createdAt: new Date("2026-08-26T12:05:00.000Z"),
        });
        await repositories.conversations.save(
          conversationSnapshot({
            id: "00000000-0000-7000-8000-000000000199",
            organizationId: tenantA.organizationId,
            status: "OPEN",
          }),
        );
      }),
    ).rejects.toThrow();

    await expect(admin!.message.findUnique({ where: { id: attemptedMessageId } })).resolves.toBeNull();
  });

  it("commits inbound message and conversation activity as one use-case transaction", async () => {
    const persistence = createPrismaConversationRepositories(runtime!);
    const service = new ConversationApplicationService(
      persistence,
      { async requestReply() {} },
      { async publish() {} },
      () => new Date("2026-08-26T12:05:00.000Z"),
    );
    const messageId = "00000000-0000-7000-8000-000000000144";

    await service.receiveInboundMessage(tenantA, {
      id: messageId,
      conversationId: conversationA,
      content: "hello",
    });

    await expect(admin!.message.findUniqueOrThrow({ where: { id: messageId } })).resolves.toMatchObject({
      organizationId: tenantA.organizationId,
      conversationId: conversationA,
    });
    await expect(
      admin!.conversation.findUniqueOrThrow({ where: { id: conversationA } }),
    ).resolves.toMatchObject({ lastActivityAt: new Date("2026-08-26T12:05:00.000Z") });
  });
});

function conversationSnapshot(
  values: Pick<ConversationSnapshot, "id" | "organizationId" | "status">,
): ConversationSnapshot {
  const timestamp = new Date("2026-08-26T12:05:00.000Z");
  return {
    ...values,
    lastActivityAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function withRuntimeCredentials(url: string): string {
  const parsed = new URL(url);
  parsed.username = "issuespan_app";
  parsed.password = "issuespan-app-local-only";
  return parsed.toString();
}

function resolveTestDatabaseUrl(
  testDatabaseUrl: string | undefined,
  applicationDatabaseUrl: string | undefined,
  isGitHubActions: boolean,
): string | undefined {
  if (!testDatabaseUrl) {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(testDatabaseUrl);
  } catch {
    throw new Error("DATABASE_TEST_URL must be a valid PostgreSQL URL");
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("DATABASE_TEST_URL must be a valid PostgreSQL URL");
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  const hasDedicatedTestName = /(?:^|[-_])test(?:$|[-_])/.test(databaseName.toLowerCase());
  const isEphemeralGitHubDatabase =
    isGitHubActions && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);

  if (!hasDedicatedTestName && !isEphemeralGitHubDatabase) {
    throw new Error(
      "DATABASE_TEST_URL must point to a dedicated test database (for example, issuespan_test)",
    );
  }

  if (
    !isEphemeralGitHubDatabase
    && applicationDatabaseUrl
    && new URL(applicationDatabaseUrl).toString() === parsed.toString()
  ) {
    throw new Error("DATABASE_TEST_URL must not be the same as DATABASE_URL");
  }

  return testDatabaseUrl;
}
