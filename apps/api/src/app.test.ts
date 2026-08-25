import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { hashPassword } from "@issuespan/identity";

const user = { id: "00000000-0000-7000-8000-000000000001", email: "owner@example.test", displayName: "Owner", passwordHash: "", isActive: true };

function database() {
  const sessions: any[] = [];
  return {
    sessions,
    user: { findUnique: async ({ where }: any) => where.email === user.email ? user : null, update: async () => user, findUniqueOrThrow: async () => ({ ...user, memberships: [] }) },
    session: { create: async ({ data }: any) => { const record = { id: "00000000-0000-7000-8000-000000000002", revokedAt: null, ...data, user }; sessions.push(record); return record; }, findUnique: async ({ where }: any) => sessions.find((session) => session.tokenHash === where.tokenHash) ?? null, update: async ({ where, data }: any) => { const session = sessions.find((item) => item.id === where.id); Object.assign(session, data); return session; } },
  } as any;
}

describe("authentication API", () => {
  it("returns Problem Details 400 for malformed JSON", async () => {
    const app = buildApp({ database: database(), trustedOrigins: ["http://localhost:5173"] });
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

  it("sets HttpOnly opaque session cookie and never serializes its raw or hashed value", async () => {
    user.passwordHash = await hashPassword("correct-password"); const db = database(); const app = buildApp({ database: db, trustedOrigins: ["http://localhost:5173"] });
    const response = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: user.email, password: "correct-password" } });
    expect(response.statusCode).toBe(200); expect(response.json()).toEqual({ user: { id: user.id, email: user.email, displayName: "Owner" } });
    expect((response.headers["set-cookie"] as unknown as string[]).join("\n")).toContain("HttpOnly"); expect(db.sessions[0].tokenHash).not.toContain("issuespan-session"); expect(response.body).not.toContain(db.sessions[0].tokenHash); await app.close();
  });
  it("rejects logout without CSRF and revokes a session with valid Origin and token", async () => {
    user.passwordHash = await hashPassword("correct-password"); const db = database(); const app = buildApp({ database: db, trustedOrigins: ["http://localhost:5173"] });
    const login = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: user.email, password: "correct-password" } }); const cookies = login.headers["set-cookie"] as unknown as string[];
    const cookieHeader = cookies.map((value) => value.split(";", 1)[0]).join("; "); const csrf = cookies.find((value) => value.startsWith("issuespan-csrf="))!.split(";", 1)[0].split("=", 2)[1];
    expect((await app.inject({ method: "POST", url: "/api/v1/auth/logout", headers: { cookie: cookieHeader } })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/api/v1/auth/logout", headers: { cookie: cookieHeader, origin: "http://localhost:5173", "x-csrf-token": csrf } })).statusCode).toBe(204); expect(db.sessions[0].revokedAt).toBeInstanceOf(Date); await app.close();
  });
});
