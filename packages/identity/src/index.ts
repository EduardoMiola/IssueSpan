import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import {
  TenantAccessDeniedError,
  withTenantTransaction,
  type PrismaClient,
  type TenantContext,
  type TenantRole,
} from "@issuespan/database";

export const passwordPolicy = {
  type: argon2.argon2id,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
} as const;

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

const rolePermissions: Record<TenantRole, readonly Permission[]> = {
  OWNER: permissions,
  ADMIN: ["member:manage", "customer:read", "conversation:read", "conversation:reply", "channel:manage", "escalation:manage", "audit:read"],
  AGENT: ["customer:read", "conversation:read", "conversation:reply"],
};

export class AuthenticationError extends Error {
  public readonly code = "AUTHENTICATION_REQUIRED";
}

export class AuthorizationError extends Error {
  public readonly code = "FORBIDDEN";
}

export type Clock = () => Date;
export type SecurityEvent = {
  type: "login_succeeded" | "login_failed" | "logout" | "session_rejected" | "tenant_access_denied";
  userId?: string;
  organizationId?: string;
};
export type SecurityEventSink = (event: SecurityEvent) => void | Promise<void>;

/** Converts a raw session credential to the only representation stored in PostgreSQL. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

/** Creates a 256-bit opaque browser session credential. */
export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Produces a self-describing Argon2id password hash. */
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, passwordPolicy);
}

/** Verifies a password and treats malformed hashes as authentication failures. */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/** Reports whether a stored hash no longer matches the current password policy. */
export function needsPasswordRehash(hash: string): boolean {
  return argon2.needsRehash(hash, {
    memoryCost: passwordPolicy.memoryCost,
    timeCost: passwordPolicy.timeCost,
    parallelism: passwordPolicy.parallelism,
  });
}

export class Authorization {
  /** Fails closed when tenant context or the required capability is absent. */
  require(context: TenantContext | undefined, permission: Permission): void {
    if (!context || !rolePermissions[context.role]?.includes(permission)) {
      throw new AuthorizationError("Permission denied");
    }
  }
}

/** Resolves a trusted tenant context only from a proven user Membership. */
export async function resolveTenantContext(
  client: PrismaClient,
  userId: string,
  organizationId: string,
): Promise<TenantContext> {
  try {
    return await withTenantTransaction(
      client,
      { organizationId, userId },
      async (_transaction, context) => context,
    );
  } catch (error) {
    if (error instanceof TenantAccessDeniedError) {
      throw new AuthorizationError("Organization access denied");
    }
    throw error;
  }
}

export type SessionPrincipal = {
  sessionId: string;
  userId: string;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
};

/** Authenticates an opaque token and periodically renews its bounded idle window. */
export async function authenticateSession(client: PrismaClient, rawToken: string | undefined, now: Date, refresh = true): Promise<SessionPrincipal> {
  if (!rawToken) throw new AuthenticationError("Authentication required");

  const session = await client.session.findUnique({
    where: { tokenHash: hashSessionToken(rawToken) },
    include: { user: true },
  });
  const sessionIsInvalid = !session
    || session.revokedAt
    || !session.user.isActive
    || session.idleExpiresAt <= now
    || session.absoluteExpiresAt <= now;

  if (sessionIsInvalid) throw new AuthenticationError("Authentication required");

  let idleExpiresAt = session.idleExpiresAt;
  // Bound writes while ensuring an active browser session cannot outlive its absolute expiry.
  if (refresh && session.lastSeenAt.getTime() + 5 * 60_000 <= now.getTime()) {
    idleExpiresAt = new Date(Math.min(session.absoluteExpiresAt.getTime(), now.getTime() + 8 * 60 * 60_000));
    await client.session.update({
      where: { id: session.id },
      data: { lastSeenAt: now, idleExpiresAt },
    });
  }

  return {
    sessionId: session.id,
    userId: session.userId,
    idleExpiresAt,
    absoluteExpiresAt: session.absoluteExpiresAt,
  };
}

/** Compares same-length opaque values without data-dependent byte comparisons. */
export async function verifyOpaqueToken(expected: string, received: string): Promise<boolean> {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}
