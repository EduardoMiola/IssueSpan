import type { TenantContext, TenantRole } from "./contracts.js";

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string | null;
  passwordHash: string | null;
  isActive: boolean;
};

export type SessionRecord = {
  id: string;
  userId: string;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
  lastSeenAt: Date;
  user: AuthenticatedUser;
};

export type SessionCreation = {
  userId: string;
  tokenHash: string;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  lastSeenAt: Date;
};

export type UserMembership = {
  organizationId: string;
  organizationName: string;
  role: TenantRole;
};

export type UserProfile = {
  id: string;
  email: string;
  displayName: string | null;
  memberships: UserMembership[];
};

export interface UserRepository {
  findByEmail(email: string): Promise<AuthenticatedUser | null>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
  findProfile(userId: string): Promise<UserProfile | null>;
}

export interface SessionRepository {
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  create(session: SessionCreation): Promise<void>;
  touch(sessionId: string, lastSeenAt: Date, idleExpiresAt: Date): Promise<void>;
  revoke(sessionId: string, revokedAt: Date): Promise<void>;
}

export interface MembershipRepository {
  resolveTenant(userId: string, organizationId: string): Promise<TenantContext | null>;
}

export type IdentityRepositories = {
  users: UserRepository;
  sessions: SessionRepository;
  memberships: MembershipRepository;
};
