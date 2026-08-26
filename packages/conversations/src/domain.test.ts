import { describe, expect, it } from "vitest";
import { Conversation, InvalidConversationTransitionError, Message } from "./domain.js";

const now = new Date("2026-08-26T12:00:00.000Z");

describe("Conversation", () => {
  it.each([
    ["OPEN", () => Conversation.create("conversation-1", "tenant-1", now).resolve(now)],
    ["PENDING", () => { const conversation = Conversation.create("conversation-1", "tenant-1", now); conversation.markPending(now); return conversation.resolve(now); }],
  ])("resolves from %s", (_status, transition) => {
    expect(transition().type).toBe("conversation.resolved");
  });

  it("allows reopening only a resolved conversation", () => {
    const conversation = Conversation.create("conversation-1", "tenant-1", now);
    expect(() => conversation.reopen(now)).toThrow(InvalidConversationTransitionError);
    conversation.resolve(now);
    expect(conversation.reopen(now).type).toBe("conversation.reopened");
    expect(conversation.snapshot.status).toBe("OPEN");
  });

  it("rejects empty messages and normalizes content", () => {
    expect(() => Message.create({ id: "message-1", organizationId: "tenant-1", conversationId: "conversation-1", direction: "INBOUND", content: "  " , createdAt: now })).toThrow();
    expect(Message.create({ id: "message-1", organizationId: "tenant-1", conversationId: "conversation-1", direction: "INBOUND", content: " hello ", createdAt: now }).snapshot.content).toBe("hello");
  });
});
