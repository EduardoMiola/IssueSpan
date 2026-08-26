import { describe, expect, it } from "vitest";
import { IdentityApplicationService } from "./application.js";
import { hashSessionToken } from "./domain.js";
import type { IdentityRepositories, SessionRecord } from "./ports.js";

const now = new Date("2026-08-26T12:00:00.000Z");
const user = {
  id: "user-1",
  email: "owner@example.test",
  displayName: "Owner",
  passwordHash: "stored-hash",
  isActive: true,
};

function session(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "session-1",
    userId: user.id,
    idleExpiresAt: new Date(now.getTime() + 60 * 60_000),
    absoluteExpiresAt: new Date(now.getTime() + 24 * 60 * 60_000),
    revokedAt: null,
    lastSeenAt: new Date(now.getTime() - 10 * 60_000),
    user,
    ...overrides,
  };
}

function service(storedSession: SessionRecord | null) {
  let touched: { sessionId: string; lastSeenAt: Date; idleExpiresAt: Date } | undefined;
  const repositories: IdentityRepositories = {
    users: {
      findByEmail: async () => user,
      updatePasswordHash: async () => undefined,
      findProfile: async () => null,
    },
    sessions: {
      findByTokenHash: async (tokenHash) => tokenHash === hashSessionToken("token") ? storedSession : null,
      create: async () => undefined,
      touch: async (sessionId, lastSeenAt, idleExpiresAt) => {
        touched = { sessionId, lastSeenAt, idleExpiresAt };
      },
      revoke: async () => undefined,
    },
    memberships: {
      resolveTenant: async () => null,
    },
  };
  return { service: new IdentityApplicationService(repositories), getTouched: () => touched };
}

describe("Identity application session policy", () => {
  it.each([
    ["idle expiry", { idleExpiresAt: new Date(now.getTime() - 1) }],
    ["absolute expiry", { absoluteExpiresAt: new Date(now.getTime() - 1) }],
    ["revocation", { revokedAt: new Date(now.getTime() - 1) }],
    ["inactive user", { user: { ...user, isActive: false } }],
  ])("rejects a session with %s", async (_reason, overrides) => {
    const { service: identity } = service(session(overrides));
    await expect(identity.authenticateSession("token", now)).rejects.toMatchObject({
      code: "AUTHENTICATION_REQUIRED",
    });
  });

  it("refreshes idle expiry without exceeding absolute expiry", async () => {
    const { service: identity, getTouched } = service(session({
      idleExpiresAt: new Date(now.getTime() + 30 * 60_000),
      absoluteExpiresAt: new Date(now.getTime() + 2 * 60 * 60_000),
    }));

    const principal = await identity.authenticateSession("token", now);

    expect(principal.idleExpiresAt).toEqual(new Date(now.getTime() + 2 * 60 * 60_000));
    expect(getTouched()).toEqual({
      sessionId: "session-1",
      lastSeenAt: now,
      idleExpiresAt: new Date(now.getTime() + 2 * 60 * 60_000),
    });
  });
});
