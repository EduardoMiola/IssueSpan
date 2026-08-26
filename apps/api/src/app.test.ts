import { describe, expect, it } from "vitest";
import {
  AuthenticationError,
  hashSessionToken,
  type IdentityService,
  type SecurityEvent,
  type TenantContext,
} from "@issuespan/identity";
import type { LoginResult, SessionPrincipal, UserProfile } from "@issuespan/identity";
import { buildApp } from "./app.js";

const user: UserProfile = {
  id: "00000000-0000-7000-8000-000000000001",
  email: "owner@example.test",
  displayName: "Owner",
  memberships: [],
};

class InMemoryIdentityService implements IdentityService {
  readonly sessions: Array<{ rawToken: string; tokenHash: string; principal: SessionPrincipal; revokedAt?: Date }> = [];

  async login(email: string, _password: string, now: Date): Promise<LoginResult | null> {
    if (email !== user.email) return null;

    const rawToken = "opaque-session-token";
    const principal: SessionPrincipal = {
      sessionId: "00000000-0000-7000-8000-000000000002",
      userId: user.id,
      idleExpiresAt: new Date(now.getTime() + 60 * 60_000),
      absoluteExpiresAt: new Date(now.getTime() + 24 * 60 * 60_000),
    };
    this.sessions.push({ rawToken, tokenHash: hashSessionToken(rawToken), principal });
    return {
      user: { id: user.id, email: user.email, displayName: user.displayName },
      rawToken,
      idleExpiresAt: principal.idleExpiresAt,
    };
  }

  async authenticateSession(rawToken: string | undefined): Promise<SessionPrincipal> {
    const session = this.sessions.find((candidate) => candidate.rawToken === rawToken);
    if (!session || session.revokedAt) throw new AuthenticationError("Authentication required");
    return session.principal;
  }

  async revokeSession(principal: SessionPrincipal, now: Date): Promise<void> {
    const session = this.sessions.find((candidate) => candidate.principal.sessionId === principal.sessionId);
    if (session) session.revokedAt = now;
  }

  async getProfile(): Promise<UserProfile> {
    return user;
  }

  async resolveTenantContext(_userId: string, _organizationId: string): Promise<TenantContext> {
    throw new Error("not used by route tests");
  }
}

function buildTestApp(
  identity = new InMemoryIdentityService(),
  securityEvents?: (event: SecurityEvent) => void,
) {
  return {
    app: buildApp({ identity, trustedOrigins: ["http://localhost:5173"], securityEvents }),
    identity,
  };
}

function cookieHeader(setCookie: string | string[] | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return cookies.map((cookie) => cookie.split(";", 1)[0]).join("; ");
}

function cookieValue(setCookie: string | string[] | undefined, name: string): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const cookie = cookies.find((value) => value.startsWith(`${name}=`));
  if (!cookie) throw new Error(`Missing ${name} cookie`);
  return cookie.split(";", 1)[0].split("=", 2)[1];
}

describe("authentication API", () => {
  it("returns Problem Details 400 for malformed JSON", async () => {
    const { app } = buildTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { "content-type": "application/json" },
      payload: '{"email":',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ status: 400, code: "INVALID_REQUEST" });
    await app.close();
  });

  it("sets an HttpOnly opaque session cookie without serializing its raw or hashed value", async () => {
    const { app, identity } = buildTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: user.email, password: "correct-password" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ user: { id: user.id, email: user.email, displayName: "Owner" } });
    expect(response.headers["set-cookie"]?.toString()).toContain("HttpOnly");
    expect(response.body).not.toContain(identity.sessions[0].rawToken);
    expect(response.body).not.toContain(identity.sessions[0].tokenHash);
    await app.close();
  });

  it("rejects login from an untrusted Origin", async () => {
    const { app } = buildTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { origin: "https://evil.example" },
      payload: { email: user.email, password: "correct-password" },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("keeps security events free of passwords and session credentials", async () => {
    const events: string[] = [];
    const { app } = buildTestApp(undefined, (event) => events.push(JSON.stringify(event)));
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: user.email, password: "correct-password" },
    });

    expect(response.statusCode).toBe(200);
    expect(events.join("\n")).not.toContain("correct-password");
    expect(events.join("\n")).not.toContain("opaque-session-token");
    expect(events.join("\n")).not.toContain(hashSessionToken("opaque-session-token"));
    await app.close();
  });

  it("keeps the CSRF token stable while refreshing the session cookie", async () => {
    const { app } = buildTestApp();
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: user.email, password: "correct-password" },
    });
    const firstCsrf = cookieValue(login.headers["set-cookie"], "issuespan-csrf");
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      headers: { cookie: cookieHeader(login.headers["set-cookie"]) },
    });

    expect(response.statusCode).toBe(200);
    expect(cookieValue(response.headers["set-cookie"], "issuespan-csrf")).toBe(firstCsrf);
    expect(response.body).not.toContain("passwordHash");
    expect(response.body).not.toContain("tokenHash");
    await app.close();
  });

  it("rejects logout without CSRF and revokes a session with valid Origin and token", async () => {
    const { app, identity } = buildTestApp();
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: user.email, password: "correct-password" },
    });
    const cookies = login.headers["set-cookie"];
    const sessionCookie = cookieHeader(cookies);
    const csrf = cookieValue(cookies, "issuespan-csrf");

    const missingCsrf = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { cookie: sessionCookie },
    });
    expect(missingCsrf.statusCode).toBe(403);

    const wrongOrigin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: {
        cookie: sessionCookie,
        origin: "https://evil.example",
        "x-csrf-token": csrf,
      },
    });
    expect(wrongOrigin.statusCode).toBe(403);

    const logout = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: {
        cookie: sessionCookie,
        origin: "http://localhost:5173",
        "x-csrf-token": csrf,
      },
    });
    expect(logout.statusCode).toBe(204);
    expect(identity.sessions[0].revokedAt).toBeInstanceOf(Date);
    await app.close();
  });
});
