import type { Conversation, ConversationEvent, ConversationSnapshot, Message, MessageSnapshot } from "./domain.js";
import type { TenantContext } from "./contracts.js";

export interface ConversationRepository {
  findById(context: TenantContext, conversationId: string): Promise<ConversationSnapshot | null>;
  create(context: TenantContext, conversation: ConversationSnapshot): Promise<void>;
  save(context: TenantContext, conversation: ConversationSnapshot): Promise<void>;
}

export interface MessageRepository {
  add(context: TenantContext, message: MessageSnapshot): Promise<void>;
  listByConversation(context: TenantContext, conversationId: string): Promise<MessageSnapshot[]>;
}

export interface MessagingPort {
  requestReply(context: TenantContext, message: MessageSnapshot): Promise<void>;
}

export interface ConversationEventSink {
  publish(event: ConversationEvent): Promise<void>;
}

export type ConversationRepositories = {
  conversations: ConversationRepository;
  messages: MessageRepository;
};

export type { Conversation, Message };
