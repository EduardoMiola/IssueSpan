import type { PrismaClient } from "./generated/client/client.js";

export type TenantRole = "OWNER" | "ADMIN" | "AGENT";

/** Server-derived after authenticating a User and proving a Membership. */
export type TenantContext = {
  organizationId: string;
  userId: string;
  membershipId: string;
  role: TenantRole;
};

export async function withTenantTransaction<T>(
  client: PrismaClient,
  context: TenantContext | undefined,
  callback: (transaction: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => Promise<T>,
): Promise<T> {
  if (!context?.organizationId) throw new Error("TenantContext is required");
  return client.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT set_config('app.organization_id', ${context.organizationId}, true)`;
    return callback(transaction);
  }, { isolationLevel: "ReadCommitted" });
}
