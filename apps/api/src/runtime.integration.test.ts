import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "@issuespan/database";
import { hashPassword } from "@issuespan/identity";
import { buildApp } from "./app.js";

const adminUrl = process.env.DATABASE_TEST_URL;
const tenantA = "00000000-0000-7000-8000-000000000101";
const tenantB = "00000000-0000-7000-8000-000000000102";
const userId = "00000000-0000-7000-8000-000000000111";

function restrictedRuntimeUrl(url: string): string {
  const parsed = new URL(url);
  parsed.username = "issuespan_app";
  parsed.password = "issuespan-app-local-only";
  return parsed.toString();
}

function toCookieHeader(setCookie: string | string[] | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return cookies.map((cookie) => cookie.split(";", 1)[0]).join("; ");
}

describe.skipIf(!adminUrl)("restricted API runtime", () => {
  let admin: ReturnType<typeof createDatabaseClient>;
  let runtime: ReturnType<typeof createDatabaseClient>;
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    admin = createDatabaseClient(adminUrl!);
    runtime = createDatabaseClient(restrictedRuntimeUrl(adminUrl!));
    app = buildApp({
      database: runtime,
      trustedOrigins: ["http://localhost:5173"],
    });
    const passwordHash = await hashPassword("correct-password");
    await admin.$executeRaw`
      TRUNCATE outbox_events, messages, conversations, contacts, customer_accounts,
        memberships, sessions, users, organizations CASCADE
    `;
    await admin.organization.createMany({
      data: [
        { id: tenantA, slug: "runtime-a", name: "Runtime A" },
        { id: tenantB, slug: "runtime-b", name: "Runtime B" },
      ],
    });
    await admin.user.create({
      data: { id: userId, email: "runtime@example.test", passwordHash, displayName: "Runtime User" },
    });
    await admin.membership.create({
      data: { organizationId: tenantA, userId, role: "OWNER" },
    });
  });

  afterAll(async () => {
    if (app) await app.close();
    if (runtime) await runtime.$disconnect();
    if (admin) await admin.$disconnect();
  });

  it("uses the restricted role for login, me, and membership-derived TenantContext", async () => {
    const role = await runtime.$queryRaw<Array<{ rolsuper: boolean; rolbypassrls: boolean }>>`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
    `;
    expect(role[0]).toEqual({ rolsuper: false, rolbypassrls: false });

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "runtime@example.test", password: "correct-password" },
    });
    expect(login.statusCode).toBe(200);

    const cookieHeader = toCookieHeader(login.headers["set-cookie"]);
    const me = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      headers: { cookie: cookieHeader },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().memberships).toEqual([
      { organizationId: tenantA, organizationName: "Runtime A", role: "OWNER" },
    ]);

    const allowed = await app.inject({
      method: "GET",
      url: `/api/v1/organizations/${tenantA}/context`,
      headers: { cookie: cookieHeader },
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().tenant).toMatchObject({ organizationId: tenantA, userId, role: "OWNER" });

    const denied = await app.inject({
      method: "GET",
      url: `/api/v1/organizations/${tenantB}/context`,
      headers: { cookie: cookieHeader },
    });
    expect(denied.statusCode).toBe(403);
    expect(denied.body).not.toContain("Runtime B");
  });
});
