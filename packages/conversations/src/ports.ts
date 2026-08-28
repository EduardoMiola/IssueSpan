import type {
  Conversation,
  ConversationEvent,
  ConversationSnapshot,
  Message,
  MessageSnapshot,
} from "./domain.js";
import type { TenantContext } from "./contracts.js";

export interface ConversationRepository {
  findById(conversationId: string): Promise<ConversationSnapshot | null>;
  create(conversation: ConversationSnapshot): Promise<void>;
  save(conversation: ConversationSnapshot): Promise<void>;
}

export interface MessageRepository {
  findById(messageId: string): Promise<MessageSnapshot | null>;
  add(message: MessageSnapshot): Promise<void>;
  listByConversation(conversationId: string): Promise<MessageSnapshot[]>;
}

export interface MessagingPort {
  requestReply(context: TenantContext, message: MessageSnapshot): Promise<void>;
}

export interface ConversationEventSink {
  publish(event: ConversationEvent): Promise<void>;
}

export type TenantConversationRepositories = {
  conversations: ConversationRepository;
  messages: MessageRepository;
};

export interface ConversationPersistence {
  withTenantTransaction<T>(
    context: TenantContext | undefined,
    callback: (repositories: TenantConversationRepositories) => Promise<T>,
  ): Promise<T>;
}

export type { Conversation, Message };
