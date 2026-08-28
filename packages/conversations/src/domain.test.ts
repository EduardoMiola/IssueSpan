import { describe, expect, it } from "vitest";
import { Conversation, InvalidConversationTransitionError, Message } from "./domain.js";

const now = new Date("2026-08-26T12:00:00.000Z");
const later = new Date("2026-08-26T12:05:00.000Z");

describe("Conversation", () => {
  it("creates an OPEN tenant-owned conversation", () => {
    const conversation = Conversation.create("conversation-1", "tenant-1", now).snapshot;

    expect(conversation).toEqual({
      id: "conversation-1",
      organizationId: "tenant-1",
      status: "OPEN",
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
    });
  });

  it("allows OPEN to become PENDING", () => {
    const conversation = Conversation.create("conversation-1", "tenant-1", now);

    conversation.markPending(later);

    expect(conversation.snapshot).toMatchObject({
      status: "PENDING",
      lastActivityAt: later,
      updatedAt: later,
    });
  });

  it.each([
    ["OPEN", () => Conversation.create("conversation-1", "tenant-1", now).resolve(later)],
    [
      "PENDING",
      () => {
        const conversation = Conversation.create("conversation-1", "tenant-1", now);
        conversation.markPending(now);
        return conversation.resolve(later);
      },
    ],
  ])("resolves from %s", (_status, transition) => {
    expect(transition()).toMatchObject({
      type: "conversation.resolved",
      occurredAt: later,
    });
  });

  it("allows only RESOLVED to reopen", () => {
    const open = Conversation.create("conversation-1", "tenant-1", now);
    expect(() => open.reopen(later)).toThrow(InvalidConversationTransitionError);

    const pending = Conversation.create("conversation-2", "tenant-1", now);
    pending.markPending(now);
    expect(() => pending.reopen(later)).toThrow(InvalidConversationTransitionError);

    open.resolve(now);
    expect(open.reopen(later).type).toBe("conversation.reopened");
    expect(open.snapshot.status).toBe("OPEN");
  });

  it("rejects repeated and otherwise invalid transitions predictably", () => {
    const pending = Conversation.create("conversation-1", "tenant-1", now);
    pending.markPending(now);
    expect(() => pending.markPending(later)).toThrow(InvalidConversationTransitionError);

    const resolved = Conversation.create("conversation-2", "tenant-1", now);
    resolved.resolve(now);
    expect(() => resolved.resolve(later)).toThrow(InvalidConversationTransitionError);
    expect(() => resolved.markPending(later)).toThrow(InvalidConversationTransitionError);
  });

  it("records activity without changing lifecycle status", () => {
    const conversation = Conversation.create("conversation-1", "tenant-1", now);

    conversation.recordActivity(later);

    expect(conversation.snapshot).toMatchObject({
      status: "OPEN",
      lastActivityAt: later,
      updatedAt: later,
    });
  });
});

describe("Message", () => {
  it("rejects empty messages and normalizes content", () => {
    expect(() =>
      Message.create({
        id: "message-1",
        organizationId: "tenant-1",
        conversationId: "conversation-1",
        direction: "INBOUND",
        content: "  ",
        createdAt: now,
      }),
    ).toThrow();

    expect(
      Message.create({
        id: "message-1",
        organizationId: "tenant-1",
        conversationId: "conversation-1",
        direction: "INBOUND",
        content: " hello ",
        createdAt: now,
      }).snapshot.content,
    ).toBe("hello");
  });
});
