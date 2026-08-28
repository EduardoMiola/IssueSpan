export type TenantRole = "OWNER" | "ADMIN" | "AGENT";

export type TenantContext = {
  organizationId: string;
  userId: string;
  membershipId: string;
  role: TenantRole;
};

export type Clock = () => Date;

export class MissingTenantContextError extends Error {
  public readonly code = "TENANT_CONTEXT_REQUIRED";
}
