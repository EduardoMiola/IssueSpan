import {
  Conversation,
  Message,
  type ConversationEvent,
  type ConversationSnapshot,
  type MessageSnapshot,
} from "./domain.js";
import { MissingTenantContextError, type Clock, type TenantContext } from "./contracts.js";
import type {
  ConversationEventSink,
  ConversationPersistence,
  MessagingPort,
  TenantConversationRepositories,
} from "./ports.js";

export type CreateConversationCommand = { id: string; organizationId: string };
export type MessageCommand = { id: string; conversationId: string; content: string };

export class ConversationApplicationService {
  constructor(
    private readonly persistence: ConversationPersistence,
    private readonly messaging: MessagingPort,
    private readonly events: ConversationEventSink,
    private readonly clock: Clock = () => new Date(),
  ) {}

  async create(context: TenantContext | undefined, command: CreateConversationCommand): Promise<ConversationSnapshot> {
    const tenant = requireContext(context);
    if (command.organizationId !== tenant.organizationId) throw new Error("Organization does not match tenant context");
    const conversation = Conversation.create(command.id, tenant.organizationId, this.clock());
    await this.persistence.withTenantTransaction(tenant, (repositories) =>
      repositories.conversations.create(conversation.snapshot),
    );
    await this.events.publish({ type: "conversation.created", conversationId: conversation.snapshot.id, organizationId: tenant.organizationId, occurredAt: conversation.snapshot.createdAt });
    return conversation.snapshot;
  }

  async receiveInboundMessage(context: TenantContext | undefined, command: MessageCommand): Promise<MessageSnapshot> {
    const tenant = requireContext(context);
    const now = this.clock();
    const message = Message.create({ id: command.id, organizationId: tenant.organizationId, conversationId: command.conversationId, direction: "INBOUND", content: command.content, createdAt: now });
    await this.persistence.withTenantTransaction(tenant, async (repositories) => {
      const conversation = await this.load(repositories, command.conversationId);
      conversation.recordActivity(now);
      await repositories.messages.add(message.snapshot);
      await repositories.conversations.save(conversation.snapshot);
    });
    await this.events.publish({ type: "message.received", conversationId: command.conversationId, messageId: message.snapshot.id, organizationId: tenant.organizationId, occurredAt: now });
    return message.snapshot;
  }

  async resolve(context: TenantContext | undefined, conversationId: string): Promise<ConversationSnapshot> {
    return this.transition(context, conversationId, (conversation, now) => conversation.resolve(now));
  }

  async reopen(context: TenantContext | undefined, conversationId: string): Promise<ConversationSnapshot> {
    return this.transition(context, conversationId, (conversation, now) => conversation.reopen(now));
  }

  async requestReply(context: TenantContext | undefined, command: MessageCommand): Promise<MessageSnapshot> {
    const tenant = requireContext(context);
    const now = this.clock();
    const message = Message.create({ id: command.id, organizationId: tenant.organizationId, conversationId: command.conversationId, direction: "OUTBOUND", content: command.content, createdAt: now });
    await this.persistence.withTenantTransaction(tenant, async (repositories) => {
      const conversation = await this.load(repositories, command.conversationId);
      conversation.markPending(now);
      await repositories.messages.add(message.snapshot);
      await repositories.conversations.save(conversation.snapshot);
    });
    await this.messaging.requestReply(tenant, message.snapshot);
    await this.events.publish({ type: "reply.requested", conversationId: command.conversationId, messageId: message.snapshot.id, organizationId: tenant.organizationId, occurredAt: now });
    return message.snapshot;
  }

  private async transition(context: TenantContext | undefined, conversationId: string, action: (conversation: Conversation, now: Date) => ConversationEvent): Promise<ConversationSnapshot> {
    const tenant = requireContext(context);
    const now = this.clock();
    const { event, snapshot } = await this.persistence.withTenantTransaction(
      tenant,
      async (repositories) => {
        const conversation = await this.load(repositories, conversationId);
        const event = action(conversation, now);
        await repositories.conversations.save(conversation.snapshot);
        return { event, snapshot: conversation.snapshot };
      },
    );
    await this.events.publish(event);
    return snapshot;
  }

  private async load(
    repositories: TenantConversationRepositories,
    conversationId: string,
  ): Promise<Conversation> {
    const snapshot = await repositories.conversations.findById(conversationId);
    if (!snapshot) throw new Error("Conversation not found");
    return Conversation.rehydrate(snapshot);
  }
}

function requireContext(context: TenantContext | undefined): TenantContext {
  if (!context) throw new MissingTenantContextError("Tenant context is required");
  return context;
}
