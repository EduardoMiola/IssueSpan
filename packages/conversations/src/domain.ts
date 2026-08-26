export type ConversationStatus = "OPEN" | "PENDING" | "RESOLVED";
export type MessageDirection = "INBOUND" | "OUTBOUND";

export class InvalidConversationTransitionError extends Error {
  public readonly code = "INVALID_CONVERSATION_TRANSITION";
}

export class InvalidMessageError extends Error {
  public readonly code = "INVALID_MESSAGE";
}

export type ConversationSnapshot = {
  id: string;
  organizationId: string;
  status: ConversationStatus;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type MessageSnapshot = {
  id: string;
  organizationId: string;
  conversationId: string;
  direction: MessageDirection;
  content: string;
  createdAt: Date;
};

export type ConversationEvent =
  | { type: "conversation.created"; conversationId: string; organizationId: string; occurredAt: Date }
  | { type: "message.received"; conversationId: string; messageId: string; organizationId: string; occurredAt: Date }
  | { type: "conversation.resolved"; conversationId: string; organizationId: string; occurredAt: Date }
  | { type: "conversation.reopened"; conversationId: string; organizationId: string; occurredAt: Date }
  | { type: "reply.requested"; conversationId: string; messageId: string; organizationId: string; occurredAt: Date };

export class Conversation {
  private constructor(private readonly state: ConversationSnapshot) {}

  static create(id: string, organizationId: string, now: Date): Conversation {
    requireIdentifier(id, "conversation id");
    requireIdentifier(organizationId, "organization id");
    return new Conversation({
      id,
      organizationId,
      status: "OPEN",
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(snapshot: ConversationSnapshot): Conversation {
    return new Conversation({ ...snapshot, lastActivityAt: cloneDate(snapshot.lastActivityAt), createdAt: cloneDate(snapshot.createdAt), updatedAt: cloneDate(snapshot.updatedAt) });
  }

  get snapshot(): ConversationSnapshot {
    return { ...this.state, lastActivityAt: cloneDate(this.state.lastActivityAt), createdAt: cloneDate(this.state.createdAt), updatedAt: cloneDate(this.state.updatedAt) };
  }

  resolve(now: Date): ConversationEvent {
    this.transitionTo("RESOLVED", ["OPEN", "PENDING"], now);
    return { type: "conversation.resolved", conversationId: this.state.id, organizationId: this.state.organizationId, occurredAt: now };
  }

  reopen(now: Date): ConversationEvent {
    this.transitionTo("OPEN", ["RESOLVED"], now);
    return { type: "conversation.reopened", conversationId: this.state.id, organizationId: this.state.organizationId, occurredAt: now };
  }

  markPending(now: Date): void {
    this.transitionTo("PENDING", ["OPEN"], now);
  }

  recordActivity(now: Date): void {
    this.state.lastActivityAt = now;
    this.state.updatedAt = now;
  }

  private transitionTo(next: ConversationStatus, allowed: ConversationStatus[], now: Date): void {
    if (!allowed.includes(this.state.status)) {
      throw new InvalidConversationTransitionError(`Cannot move ${this.state.status} to ${next}`);
    }
    this.state.status = next;
    this.recordActivity(now);
  }
}

export class Message {
  private constructor(private readonly state: MessageSnapshot) {}

  static create(snapshot: MessageSnapshot): Message {
    requireIdentifier(snapshot.id, "message id");
    requireIdentifier(snapshot.organizationId, "organization id");
    requireIdentifier(snapshot.conversationId, "conversation id");
    if (!snapshot.content.trim()) throw new InvalidMessageError("Message content is required");
    return new Message({ ...snapshot, content: snapshot.content.trim(), createdAt: cloneDate(snapshot.createdAt) });
  }

  get snapshot(): MessageSnapshot {
    return { ...this.state, createdAt: cloneDate(this.state.createdAt) };
  }
}

function requireIdentifier(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} is required`);
}

function cloneDate(value: Date): Date {
  return new Date(value.getTime());
}
