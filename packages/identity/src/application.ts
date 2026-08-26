import {
  AuthenticationError,
  AuthorizationError,
  createSessionToken,
  hashPassword,
  hashSessionToken,
  needsPasswordRehash,
  verifyPassword,
} from "./domain.js";
import type { TenantContext } from "./contracts.js";
import type {
  IdentityRepositories,
  SessionRecord,
  UserProfile,
} from "./ports.js";

const IDLE_SESSION_MS = 8 * 60 * 60_000;
const ABSOLUTE_SESSION_MS = 7 * 24 * 60 * 60_000;
const invalidPasswordHash = hashPassword("IssueSpan-invalid-login-password");

export type LoginResult = {
  user: Pick<UserProfile, "id" | "email" | "displayName">;
  rawToken: string;
  idleExpiresAt: Date;
};

export type SessionPrincipal = {
  sessionId: string;
  userId: string;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
};

export interface IdentityService {
  login(email: string, password: string, now: Date): Promise<LoginResult | null>;
  authenticateSession(rawToken: string | undefined, now: Date, refresh?: boolean): Promise<SessionPrincipal>;
  revokeSession(principal: SessionPrincipal, now: Date): Promise<void>;
  getProfile(userId: string): Promise<UserProfile>;
  resolveTenantContext(userId: string, organizationId: string): Promise<TenantContext>;
}

export class IdentityApplicationService implements IdentityService {
  constructor(private readonly repositories: IdentityRepositories) {}

  async login(email: string, password: string, now: Date): Promise<LoginResult | null> {
    const user = await this.repositories.users.findByEmail(email);
    const passwordHash = user?.passwordHash ?? await invalidPasswordHash;
    const passwordIsValid = await verifyPassword(passwordHash, password);

    if (!user || !user.isActive || !user.passwordHash || !passwordIsValid) return null;

    if (needsPasswordRehash(user.passwordHash)) {
      await this.repositories.users.updatePasswordHash(user.id, await hashPassword(password));
    }

    const rawToken = createSessionToken();
    const idleExpiresAt = new Date(now.getTime() + IDLE_SESSION_MS);
    await this.repositories.sessions.create({
      userId: user.id,
      tokenHash: hashSessionToken(rawToken),
      idleExpiresAt,
      absoluteExpiresAt: new Date(now.getTime() + ABSOLUTE_SESSION_MS),
      lastSeenAt: now,
    });

    return {
      user: { id: user.id, email: user.email, displayName: user.displayName },
      rawToken,
      idleExpiresAt,
    };
  }

  async authenticateSession(
    rawToken: string | undefined,
    now: Date,
    refresh = true,
  ): Promise<SessionPrincipal> {
    if (!rawToken) throw new AuthenticationError("Authentication required");

    const session = await this.repositories.sessions.findByTokenHash(hashSessionToken(rawToken));
    if (!session || sessionIsInvalid(session, now)) {
      throw new AuthenticationError("Authentication required");
    }

    let idleExpiresAt = session.idleExpiresAt;
    if (refresh && shouldRefreshSession(session, now)) {
      idleExpiresAt = new Date(Math.min(
        session.absoluteExpiresAt.getTime(),
        now.getTime() + IDLE_SESSION_MS,
      ));
      await this.repositories.sessions.touch(session.id, now, idleExpiresAt);
    }

    return {
      sessionId: session.id,
      userId: session.userId,
      idleExpiresAt,
      absoluteExpiresAt: session.absoluteExpiresAt,
    };
  }

  async revokeSession(principal: SessionPrincipal, now: Date): Promise<void> {
    await this.repositories.sessions.revoke(principal.sessionId, now);
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const profile = await this.repositories.users.findProfile(userId);
    if (!profile) throw new AuthenticationError("Authentication required");
    return profile;
  }

  async resolveTenantContext(userId: string, organizationId: string): Promise<TenantContext> {
    const context = await this.repositories.memberships.resolveTenant(userId, organizationId);
    if (!context) throw new AuthorizationError("Organization access denied");
    return context;
  }
}

function sessionIsInvalid(session: SessionRecord, now: Date): boolean {
  return Boolean(
    session.revokedAt
    || !session.user.isActive
    || session.idleExpiresAt <= now
    || session.absoluteExpiresAt <= now,
  );
}

function shouldRefreshSession(session: SessionRecord, now: Date): boolean {
  return session.lastSeenAt.getTime() + 5 * 60_000 <= now.getTime();
}
