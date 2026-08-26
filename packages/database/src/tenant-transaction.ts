import type { PrismaClient } from "./generated/client/client.js";

type TransactionClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export type TenantRole = "OWNER" | "ADMIN" | "AGENT";
export type TenantSelector = { organizationId: string; userId: string };

/** Server-derived inside the transaction after Membership has been proven. */
export type TenantContext = TenantSelector & {
  membershipId: string;
  role: TenantRole;
};

export class TenantAccessDeniedError extends Error {
  public readonly code = "TENANT_ACCESS_DENIED";
}

/** Establishes RLS scope, proves Membership, and only then exposes the transaction. */
export async function withTenantTransaction<T>(
  client: PrismaClient,
  selector: TenantSelector | undefined,
  callback: (transaction: TransactionClient, context: TenantContext) => Promise<T>,
): Promise<T> {
  if (!selector?.organizationId || !selector.userId) {
    throw new TenantAccessDeniedError("Authenticated tenant selector is required");
  }

  return client.$transaction(async (transaction) => {
    await setTransactionContext(transaction, "app.organization_id", selector.organizationId);
    await setTransactionContext(transaction, "app.user_id", selector.userId);

    const membership = await transaction.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: selector.organizationId,
          userId: selector.userId,
        },
      },
    });
    if (!membership || !isTenantRole(membership.role)) {
      throw new TenantAccessDeniedError("Organization access denied");
    }

    const context: TenantContext = {
      ...selector,
      membershipId: membership.id,
      role: membership.role,
    };
    return callback(transaction, context);
  }, { isolationLevel: "ReadCommitted" });
}

/** Gives an authenticated user visibility only to their own Membership rows. */
export async function withUserTransaction<T>(
  client: PrismaClient,
  userId: string | undefined,
  callback: (transaction: TransactionClient) => Promise<T>,
): Promise<T> {
  if (!userId) throw new TenantAccessDeniedError("Authenticated user is required");

  return client.$transaction(async (transaction) => {
    await setTransactionContext(transaction, "app.user_id", userId);
    return callback(transaction);
  }, { isolationLevel: "ReadCommitted" });
}

async function setTransactionContext(
  transaction: TransactionClient,
  setting: "app.organization_id" | "app.user_id",
  value: string,
): Promise<void> {
  await transaction.$executeRaw`SELECT set_config(${setting}, ${value}, true)`;
}

function isTenantRole(role: string): role is TenantRole {
  return role === "OWNER" || role === "ADMIN" || role === "AGENT";
}
