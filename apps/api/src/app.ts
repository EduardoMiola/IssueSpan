import { randomBytes } from "node:crypto";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import { AuthenticationError, AuthorizationError, authenticateSession, createSessionToken, hashSessionToken, hashPassword, needsPasswordRehash, resolveTenantContext, verifyPassword, type SecurityEventSink } from "@issuespan/identity";
import type { PrismaClient } from "@issuespan/database";

const loginSchema = z.object({ email: z.string().email().max(320).transform((value) => value.trim().toLowerCase()), password: z.string().min(1).max(1024) });
const genericLoginFailure = { type: "about:blank", title: "Unauthorized", status: 401, detail: "Invalid email or password.", code: "INVALID_CREDENTIALS" };
const invalidPasswordHash = hashPassword("IssueSpan-invalid-login-password");
type AppOptions = { database: PrismaClient; production?: boolean; trustedOrigins: readonly string[]; now?: () => Date; securityEvents?: SecurityEventSink; };

export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({ logger: false });
  const now = options.now ?? (() => new Date());
  const production = options.production ?? process.env.NODE_ENV === "production";
  const sessionCookie = production ? "__Host-issuespan-session" : "issuespan-session";
  const csrfCookie = production ? "__Host-issuespan-csrf" : "issuespan-csrf";
  const cookieBase = { path: "/", httpOnly: true, secure: production, sameSite: "lax" as const };
  const loginAttempts = new Map<string, { count: number; resetAt: number }>();
  const emit = async (event: Parameters<SecurityEventSink>[0]) => { await options.securityEvents?.(event); };
  app.register(cookie);
  app.register(cors, { credentials: true, origin: (origin, callback) => callback(null, !origin || options.trustedOrigins.includes(origin)) });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AuthenticationError) return reply.status(401).type("application/problem+json").send({ type: "about:blank", title: "Unauthorized", status: 401, detail: "Authentication required.", code: error.code });
    if (error instanceof AuthorizationError) return reply.status(403).type("application/problem+json").send({ type: "about:blank", title: "Forbidden", status: 403, detail: "Access denied.", code: error.code });
    if (error instanceof z.ZodError) return reply.status(400).type("application/problem+json").send({ type: "about:blank", title: "Bad Request", status: 400, detail: "Invalid request.", code: "INVALID_REQUEST" });
    return reply.status(500).type("application/problem+json").send({ type: "about:blank", title: "Internal Server Error", status: 500, detail: "Unexpected error.", code: "INTERNAL_ERROR" });
  });

  const setSessionCookies = (reply: any, token: string, idleExpiresAt = new Date(now().getTime() + 8 * 60 * 60_000)) => {
    const maxAge = Math.max(0, Math.floor((idleExpiresAt.getTime() - now().getTime()) / 1000));
    reply.setCookie(sessionCookie, token, { ...cookieBase, maxAge });
    reply.setCookie(csrfCookie, randomBytes(32).toString("base64url"), { path: "/", httpOnly: false, secure: production, sameSite: "lax", maxAge: 60 * 60 * 8 });
  };
  const requireBrowserMutation = async (request: any) => {
    const origin = request.headers.origin;
    if (!origin || !options.trustedOrigins.includes(origin)) throw new AuthorizationError("Invalid origin");
    const csrf = request.headers["x-csrf-token"];
    if (typeof csrf !== "string" || !request.cookies[csrfCookie] || csrf !== request.cookies[csrfCookie]) throw new AuthorizationError("CSRF validation failed");
  };
  const current = async (request: any, reply?: any, refresh = true) => {
    const principal = await authenticateSession(options.database, request.cookies[sessionCookie], now(), refresh);
    if (refresh && reply) setSessionCookies(reply, request.cookies[sessionCookie], principal.idleExpiresAt);
    return principal;
  };
  const attempt = (key: string, limit: number, timestamp: number) => {
    const prior = loginAttempts.get(key);
    if (!prior || prior.resetAt <= timestamp) { loginAttempts.delete(key); loginAttempts.set(key, { count: 1, resetAt: timestamp + 15 * 60_000 }); return true; }
    if (prior.count >= limit) return false; loginAttempts.delete(key); loginAttempts.set(key, { ...prior, count: prior.count + 1 }); return true;
  };
  const loginAllowed = (ip: string, email: string) => {
    const timestamp = now().getTime();
    for (const [key, value] of loginAttempts) if (value.resetAt <= timestamp) loginAttempts.delete(key);
    while (loginAttempts.size >= 10_000) loginAttempts.delete(loginAttempts.keys().next().value!);
    return attempt(`ip:${ip}`, 20, timestamp) && attempt(`account:${ip}:${email}`, 5, timestamp);
  };

  app.post("/api/v1/auth/login", async (request, reply) => {
    const command = loginSchema.parse(request.body);
    if (!loginAllowed(request.ip, command.email)) return reply.status(429).type("application/problem+json").send({ type: "about:blank", title: "Too Many Requests", status: 429, detail: "Try again later.", code: "LOGIN_RATE_LIMITED" });
    const user = await options.database.user.findUnique({ where: { email: command.email } });
    // Always run a verification attempt to narrow email-existence timing differences.
    const valid = user?.passwordHash ? await verifyPassword(user.passwordHash, command.password) : await verifyPassword(await invalidPasswordHash, command.password);
    if (!user || !user.isActive || !user.passwordHash || !valid) { await emit({ type: "login_failed" }); return reply.status(401).type("application/problem+json").send(genericLoginFailure); }
    if (needsPasswordRehash(user.passwordHash)) await options.database.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(command.password) } });
    const rawToken = createSessionToken(); const createdAt = now();
    await options.database.session.create({ data: { userId: user.id, tokenHash: hashSessionToken(rawToken), idleExpiresAt: new Date(createdAt.getTime() + 8 * 60 * 60_000), absoluteExpiresAt: new Date(createdAt.getTime() + 7 * 24 * 60 * 60_000), lastSeenAt: createdAt, authMethod: "PASSWORD" } });
    await emit({ type: "login_succeeded", userId: user.id }); setSessionCookies(reply, rawToken);
    return reply.send({ user: { id: user.id, email: user.email, displayName: user.displayName } });
  });

  app.post("/api/v1/auth/logout", async (request, reply) => {
    await requireBrowserMutation(request);
    try { const principal = await current(request, undefined, false); await options.database.session.update({ where: { id: principal.sessionId }, data: { revokedAt: now() } }); await emit({ type: "logout", userId: principal.userId }); } catch (error) { if (!(error instanceof AuthenticationError)) throw error; }
    reply.clearCookie(sessionCookie, cookieBase); reply.clearCookie(csrfCookie, { path: "/", httpOnly: false, secure: production, sameSite: "lax" }); return reply.status(204).send();
  });

  app.get("/api/v1/me", async (request, reply) => {
    const principal = await current(request, reply);
    const user = await options.database.user.findUniqueOrThrow({ where: { id: principal.userId }, include: { memberships: { include: { organization: true } } } });
    return { user: { id: user.id, email: user.email, displayName: user.displayName }, memberships: user.memberships.map((membership) => ({ organizationId: membership.organizationId, organizationName: membership.organization.name, role: membership.role })) };
  });

  app.get("/api/v1/organizations/:organizationId/context", async (request, reply) => {
    const principal = await current(request, reply); const { organizationId } = z.object({ organizationId: z.string().uuid() }).parse(request.params);
    return { tenant: await resolveTenantContext(options.database, principal.userId, organizationId) };
  });
  return app;
}
