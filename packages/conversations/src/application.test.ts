import { describe, expect, it } from "vitest";
import { ConversationApplicationService } from "./application.js";
import { MissingTenantContextError, type TenantContext } from "./contracts.js";
import type { ConversationRepositories, MessagingPort } from "./ports.js";
import type { ConversationSnapshot, MessageSnapshot } from "./domain.js";

const tenant: TenantContext = { organizationId: "tenant-1", userId: "user-1", membershipId: "membership-1", role: "AGENT" };
const foreignTenant: TenantContext = { ...tenant, organizationId: "tenant-2" };
const initial: ConversationSnapshot = {
  id: "conversation-1", organizationId: "tenant-1", status: "OPEN",
  lastActivityAt: new Date("2026-08-26T12:00:00.000Z"),
  createdAt: new Date("2026-08-26T12:00:00.000Z"),
  updatedAt: new Date("2026-08-26T12:00:00.000Z"),
};

function setup() {
  const saved: ConversationSnapshot[] = [initial];
  const messages: MessageSnapshot[] = [];
  const repositories: ConversationRepositories = {
    conversations: {
      async findById(context, id) { return context.organizationId === "tenant-1" && id === initial.id ? saved[0] : null; },
      async create(_context, conversation) { saved.push(conversation); },
      async save(_context, conversation) { saved[0] = conversation; },
    },
    messages: {
      async add(_context, message) { messages.push(message); },
      async listByConversation(_context, id) { return messages.filter((message) => message.conversationId === id); },
    },
  };
  const messaging: MessagingPort = { async requestReply() {} };
  const events: { types: string[] } = { types: [] };
  return {
    service: new ConversationApplicationService(repositories, messaging, { async publish(event) { events.types.push(event.type); } }, () => new Date("2026-08-26T12:05:00.000Z")),
    saved,
    messages,
    events,
  };
}

describe("ConversationApplicationService", () => {
  it("fails closed without TenantContext", async () => {
    const { service } = setup();
    await expect(service.resolve(undefined, initial.id)).rejects.toBeInstanceOf(MissingTenantContextError);
  });

  it("does not expose a foreign conversation", async () => {
    const { service } = setup();
    await expect(service.resolve(foreignTenant, initial.id)).rejects.toThrow("Conversation not found");
  });

  it("stores inbound messages and emits a domain event", async () => {
    const { service, messages, events } = setup();
    const message = await service.receiveInboundMessage(tenant, { id: "message-1", conversationId: initial.id, content: "hello" });
    expect(message.direction).toBe("INBOUND");
    expect(messages).toHaveLength(1);
    expect(events.types).toEqual(["message.received"]);
  });
});
