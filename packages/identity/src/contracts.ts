export type TenantRole = "OWNER" | "ADMIN" | "AGENT";

export type TenantContext = {
  organizationId: string;
  userId: string;
  membershipId: string;
  role: TenantRole;
};

export const permissions = [
  "organization:manage",
  "member:manage",
  "customer:read",
  "conversation:read",
  "conversation:reply",
  "channel:manage",
  "escalation:manage",
  "audit:read",
] as const;

export type Permission = (typeof permissions)[number];

export type Clock = () => Date;

export type SecurityEvent = {
  type: "login_succeeded" | "login_failed" | "logout" | "session_rejected" | "tenant_access_denied";
  userId?: string;
  organizationId?: string;
};

export type SecurityEventSink = (event: SecurityEvent) => void | Promise<void>;
