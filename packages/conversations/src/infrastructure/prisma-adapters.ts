import { withTenantTransaction, type PrismaClient } from "@issuespan/database";
import type { TenantContext } from "../contracts.js";
import type {
  ConversationPersistence,
  TenantConversationRepositories,
} from "../ports.js";
import type { ConversationSnapshot, MessageSnapshot } from "../domain.js";

type TransactionClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/** Prisma is intentionally confined to this infrastructure adapter. */
export function createPrismaConversationRepositories(
  database: PrismaClient,
): ConversationPersistence {
  return {
    async withTenantTransaction(context, callback) {
      return withTenantTransaction(database, context, async (transaction, trustedContext) =>
        callback(createTransactionRepositories(transaction, trustedContext)),
      );
    },
  };
}

function createTransactionRepositories(
  transaction: TransactionClient,
  context: TenantContext,
): TenantConversationRepositories {
  return {
    conversations: {
      async findById(conversationId) {
        const row = await transaction.conversation.findUnique({
          where: {
            organizationId_id: {
              organizationId: context.organizationId,
              id: conversationId,
            },
          },
        });
        return row ? toConversationSnapshot(row) : null;
      },

      async create(conversation) {
        requireMatchingOrganization(context, conversation.organizationId);
        await transaction.conversation.create({ data: toConversationData(conversation) });
      },

      async save(conversation) {
        requireMatchingOrganization(context, conversation.organizationId);
        await transaction.conversation.update({
          where: {
            organizationId_id: {
              organizationId: context.organizationId,
              id: conversation.id,
            },
          },
          data: {
            status: conversation.status,
            lastActivityAt: conversation.lastActivityAt,
            updatedAt: conversation.updatedAt,
          },
        });
      },
    },

    messages: {
      async findById(messageId) {
        const row = await transaction.message.findUnique({
          where: {
            organizationId_id: {
              organizationId: context.organizationId,
              id: messageId,
            },
          },
        });
        return row ? toMessageSnapshot(row) : null;
      },

      async add(message) {
        requireMatchingOrganization(context, message.organizationId);
        await transaction.message.create({ data: toMessageData(message) });
      },

      async listByConversation(conversationId) {
        const rows = await transaction.message.findMany({
          where: {
            organizationId: context.organizationId,
            conversationId,
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        });
        return rows.map(toMessageSnapshot);
      },
    },
  };
}

function requireMatchingOrganization(context: TenantContext, organizationId: string): void {
  if (organizationId !== context.organizationId) {
    throw new Error("Organization does not match tenant context");
  }
}

function toConversationData(conversation: ConversationSnapshot) {
  return {
    id: conversation.id,
    organizationId: conversation.organizationId,
    status: conversation.status,
    lastActivityAt: conversation.lastActivityAt,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

function toMessageData(message: MessageSnapshot) {
  return {
    id: message.id,
    organizationId: message.organizationId,
    conversationId: message.conversationId,
    direction: message.direction,
    content: message.content,
    createdAt: message.createdAt,
  };
}

function toConversationSnapshot(row: {
  id: string;
  organizationId: string;
  status: string;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): ConversationSnapshot {
  if (row.status !== "OPEN" && row.status !== "PENDING" && row.status !== "RESOLVED") {
    throw new Error("Unknown conversation status");
  }
  return { ...row, status: row.status };
}

function toMessageSnapshot(row: {
  id: string;
  organizationId: string;
  conversationId: string;
  direction: string;
  content: string;
  createdAt: Date;
}): MessageSnapshot {
  if (row.direction !== "INBOUND" && row.direction !== "OUTBOUND") {
    throw new Error("Unknown message direction");
  }
  return { ...row, direction: row.direction };
}

export type { TenantContext };
