import { withTenantTransaction, type PrismaClient } from "@issuespan/database";
import type { TenantContext } from "../contracts.js";
import type { ConversationRepositories } from "../ports.js";
import type { ConversationSnapshot, MessageSnapshot } from "../domain.js";

/** Prisma is intentionally confined to this infrastructure adapter. */
export function createPrismaConversationRepositories(database: PrismaClient): ConversationRepositories {
  return {
    conversations: {
      async findById(context, conversationId) {
        return withTenantTransaction(database, context, async (transaction) => {
          const row = await transaction.conversation.findUnique({ where: { id: conversationId } });
          return row ? toConversationSnapshot(row) : null;
        });
      },

      async create(context, conversation) {
        await withTenantTransaction(database, context, async (transaction) => {
          await transaction.conversation.create({ data: toConversationData(conversation) });
        });
      },

      async save(context, conversation) {
        await withTenantTransaction(database, context, async (transaction) => {
          await transaction.conversation.update({
            where: { id: conversation.id },
            data: {
              status: conversation.status,
              lastActivityAt: conversation.lastActivityAt,
              updatedAt: conversation.updatedAt,
            },
          });
        });
      },
    },

    messages: {
      async add(context, message) {
        await withTenantTransaction(database, context, async (transaction) => {
          await transaction.message.create({ data: toMessageData(message) });
        });
      },

      async listByConversation(context, conversationId) {
        return withTenantTransaction(database, context, async (transaction) => {
          const rows = await transaction.message.findMany({
            where: { conversationId },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          });
          return rows.map(toMessageSnapshot);
        });
      },
    },
  };
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

function toConversationSnapshot(row: { id: string; organizationId: string; status: string; lastActivityAt: Date; createdAt: Date; updatedAt: Date }): ConversationSnapshot {
  if (row.status !== "OPEN" && row.status !== "PENDING" && row.status !== "RESOLVED") throw new Error("Unknown conversation status");
  return { ...row, status: row.status } as ConversationSnapshot;
}

function toMessageSnapshot(row: { id: string; organizationId: string; conversationId: string; direction: string; content: string; createdAt: Date }): MessageSnapshot {
  if (row.direction !== "INBOUND" && row.direction !== "OUTBOUND") throw new Error("Unknown message direction");
  return { ...row, direction: row.direction } as MessageSnapshot;
}

export type { TenantContext };
