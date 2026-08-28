import { describe, expect, it } from "vitest";
import { ConversationApplicationService } from "./application.js";
import { MissingTenantContextError, type TenantContext } from "./contracts.js";
import type {
  ConversationPersistence,
  MessagingPort,
  TenantConversationRepositories,
} from "./ports.js";
import type { ConversationSnapshot, MessageSnapshot } from "./domain.js";

const tenant: TenantContext = {
  organizationId: "tenant-1",
  userId: "user-1",
  membershipId: "membership-1",
  role: "AGENT",
};
const foreignTenant: TenantContext = { ...tenant, organizationId: "tenant-2" };
const initial: ConversationSnapshot = {
  id: "conversation-1",
  organizationId: "tenant-1",
  status: "OPEN",
  lastActivityAt: new Date("2026-08-26T12:00:00.000Z"),
  createdAt: new Date("2026-08-26T12:00:00.000Z"),
  updatedAt: new Date("2026-08-26T12:00:00.000Z"),
};
const now = new Date("2026-08-26T12:05:00.000Z");

function setup(options: { failConversationSave?: boolean } = {}) {
  const saved: ConversationSnapshot[] = [cloneConversation(initial)];
  const messages: MessageSnapshot[] = [];
  const persistence = createInMemoryPersistence(saved, messages, options);
  const replyRequests: MessageSnapshot[] = [];
  const messaging: MessagingPort = {
    async requestReply(_context, message) {
      replyRequests.push(message);
    },
  };
  const events: { types: string[] } = { types: [] };

  return {
    service: new ConversationApplicationService(
      persistence,
      messaging,
      {
        async publish(event) {
          events.types.push(event.type);
        },
      },
      () => now,
    ),
    saved,
    messages,
    replyRequests,
    events,
  };
}

describe("ConversationApplicationService", () => {
  it("fails closed without TenantContext", async () => {
    const { service } = setup();
    await expect(service.resolve(undefined, initial.id)).rejects.toBeInstanceOf(
      MissingTenantContextError,
    );
  });

  it("creates an OPEN conversation only for the trusted organization", async () => {
    const { service, saved, events } = setup();

    await expect(
      service.create(tenant, { id: "conversation-2", organizationId: foreignTenant.organizationId }),
    ).rejects.toThrow("Organization does not match tenant context");

    const created = await service.create(tenant, {
      id: "conversation-2",
      organizationId: tenant.organizationId,
    });

    expect(created.status).toBe("OPEN");
    expect(saved).toHaveLength(2);
    expect(events.types).toEqual(["conversation.created"]);
  });

  it("does not expose a foreign conversation", async () => {
    const { service } = setup();
    await expect(service.resolve(foreignTenant, initial.id)).rejects.toThrow(
      "Conversation not found",
    );
  });

  it("stores an inbound message and conversation activity atomically", async () => {
    const { service, saved, messages, events } = setup();

    const message = await service.receiveInboundMessage(tenant, {
      id: "message-1",
      conversationId: initial.id,
      content: "hello",
    });

    expect(message.direction).toBe("INBOUND");
    expect(messages).toHaveLength(1);
    expect(saved[0].lastActivityAt).toEqual(now);
    expect(events.types).toEqual(["message.received"]);
  });

  it("rolls back the inbound message when the conversation save fails", async () => {
    const { service, messages, events } = setup({ failConversationSave: true });

    await expect(
      service.receiveInboundMessage(tenant, {
        id: "message-1",
        conversationId: initial.id,
        content: "hello",
      }),
    ).rejects.toThrow("conversation save failed");

    expect(messages).toHaveLength(0);
    expect(events.types).toHaveLength(0);
  });

  it("resolves and reopens a conversation through domain transitions", async () => {
    const { service, saved, events } = setup();

    await expect(service.resolve(tenant, initial.id)).resolves.toMatchObject({
      status: "RESOLVED",
    });
    await expect(service.reopen(tenant, initial.id)).resolves.toMatchObject({ status: "OPEN" });

    expect(saved[0].status).toBe("OPEN");
    expect(events.types).toEqual(["conversation.resolved", "conversation.reopened"]);
  });

  it("records an outbound reply request without performing provider delivery", async () => {
    const { service, saved, messages, replyRequests, events } = setup();

    const message = await service.requestReply(tenant, {
      id: "message-1",
      conversationId: initial.id,
      content: "We are looking into it",
    });

    expect(message.direction).toBe("OUTBOUND");
    expect(saved[0].status).toBe("PENDING");
    expect(messages).toEqual([message]);
    expect(replyRequests).toEqual([message]);
    expect(events.types).toEqual(["reply.requested"]);
  });

  it("rejects a second reply request from PENDING without partial persistence", async () => {
    const { service, messages, replyRequests } = setup();
    await service.requestReply(tenant, {
      id: "message-1",
      conversationId: initial.id,
      content: "First reply",
    });

    await expect(
      service.requestReply(tenant, {
        id: "message-2",
        conversationId: initial.id,
        content: "Second reply",
      }),
    ).rejects.toMatchObject({ code: "INVALID_CONVERSATION_TRANSITION" });

    expect(messages).toHaveLength(1);
    expect(replyRequests).toHaveLength(1);
  });
});

function createInMemoryPersistence(
  conversations: ConversationSnapshot[],
  messages: MessageSnapshot[],
  options: { failConversationSave?: boolean },
): ConversationPersistence {
  return {
    async withTenantTransaction(context, callback) {
      if (!context) throw new MissingTenantContextError("Tenant context is required");

      const stagedConversations = conversations.map(cloneConversation);
      const stagedMessages = messages.map(cloneMessage);
      const repositories: TenantConversationRepositories = {
        conversations: {
          async findById(id) {
            const found = stagedConversations.find(
              (conversation) =>
                conversation.organizationId === context.organizationId && conversation.id === id,
            );
            return found ? cloneConversation(found) : null;
          },
          async create(conversation) {
            stagedConversations.push(cloneConversation(conversation));
          },
          async save(conversation) {
            if (options.failConversationSave) throw new Error("conversation save failed");
            const index = stagedConversations.findIndex(
              (candidate) =>
                candidate.organizationId === context.organizationId
                && candidate.id === conversation.id,
            );
            if (index < 0) throw new Error("Conversation not found");
            stagedConversations[index] = cloneConversation(conversation);
          },
        },
        messages: {
          async findById(id) {
            const found = stagedMessages.find(
              (message) => message.organizationId === context.organizationId && message.id === id,
            );
            return found ? cloneMessage(found) : null;
          },
          async add(message) {
            stagedMessages.push(cloneMessage(message));
          },
          async listByConversation(conversationId) {
            return stagedMessages
              .filter(
                (message) =>
                  message.organizationId === context.organizationId
                  && message.conversationId === conversationId,
              )
              .map(cloneMessage);
          },
        },
      };

      const result = await callback(repositories);
      conversations.splice(0, conversations.length, ...stagedConversations);
      messages.splice(0, messages.length, ...stagedMessages);
      return result;
    },
  };
}

function cloneConversation(conversation: ConversationSnapshot): ConversationSnapshot {
  return {
    ...conversation,
    lastActivityAt: new Date(conversation.lastActivityAt),
    createdAt: new Date(conversation.createdAt),
    updatedAt: new Date(conversation.updatedAt),
  };
}

function cloneMessage(message: MessageSnapshot): MessageSnapshot {
  return { ...message, createdAt: new Date(message.createdAt) };
}
