import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import { permissions, type Permission, type TenantContext, type TenantRole } from "./contracts.js";

export const passwordPolicy = {
  type: argon2.argon2id,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
} as const;

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

/** Compares same-length opaque values without data-dependent byte comparisons. */
export async function verifyOpaqueToken(expected: string, received: string): Promise<boolean> {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}
