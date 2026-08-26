import { randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { withUserTransaction, type PrismaClient } from "@issuespan/database";
import {
  AuthenticationError,
  AuthorizationError,
  authenticateSession,
  createSessionToken,
  hashPassword,
  hashSessionToken,
  needsPasswordRehash,
  resolveTenantContext,
  verifyPassword,
  type SecurityEventSink,
} from "@issuespan/identity";
import { LoginRateLimiter } from "./login-rate-limiter.js";
import { invalidCredentialsProblem, loginRateLimitedProblem } from "./problem-details.js";

const IDLE_SESSION_MS = 8 * 60 * 60_000;
const ABSOLUTE_SESSION_MS = 7 * 24 * 60 * 60_000;

const loginSchema = z.object({
  email: z.string().email().max(320).transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(1024),
});
const organizationSchema = z.object({ organizationId: z.string().uuid() });
const invalidPasswordHash = hashPassword("IssueSpan-invalid-login-password");

export type AuthRouteOptions = {
  database: PrismaClient;
  production: boolean;
  trustedOrigins: readonly string[];
  now: () => Date;
  securityEvents?: SecurityEventSink;
};

type CookieNames = { session: string; csrf: string };

/** Registers browser authentication routes and their HTTP security boundary. */
export function registerAuthRoutes(app: FastifyInstance, options: AuthRouteOptions): void {
  const cookieNames = getCookieNames(options.production);
  const rateLimiter = new LoginRateLimiter(options.now);

  app.post("/api/v1/auth/login", async (request, reply) => {
    const command = loginSchema.parse(request.body);
    if (!rateLimiter.isAllowed(request.ip, command.email)) {
      return reply.status(429).type("application/problem+json").send(loginRateLimitedProblem);
    }

    const user = await options.database.user.findUnique({ where: { email: command.email } });
    const passwordHash = user?.passwordHash ?? await invalidPasswordHash;
    const passwordIsValid = await verifyPassword(passwordHash, command.password);

    if (!user || !user.isActive || !user.passwordHash || !passwordIsValid) {
      await options.securityEvents?.({ type: "login_failed" });
      return reply.status(401).type("application/problem+json").send(invalidCredentialsProblem);
    }

    if (needsPasswordRehash(user.passwordHash)) {
      await options.database.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(command.password) },
      });
    }

    const rawToken = createSessionToken();
    const createdAt = options.now();
    const idleExpiresAt = new Date(createdAt.getTime() + IDLE_SESSION_MS);
    await options.database.session.create({
      data: {
        userId: user.id,
        tokenHash: hashSessionToken(rawToken),
        idleExpiresAt,
        absoluteExpiresAt: new Date(createdAt.getTime() + ABSOLUTE_SESSION_MS),
        lastSeenAt: createdAt,
        authMethod: "PASSWORD",
      },
    });

    await options.securityEvents?.({ type: "login_succeeded", userId: user.id });
    setSessionCookies(reply, rawToken, idleExpiresAt, cookieNames, options);
    return reply.send({ user: { id: user.id, email: user.email, displayName: user.displayName } });
  });

  app.post("/api/v1/auth/logout", async (request, reply) => {
    requireBrowserMutation(request, cookieNames, options.trustedOrigins);
    try {
      const principal = await getPrincipal(request, cookieNames, options, false);
      await options.database.session.update({
        where: { id: principal.sessionId },
        data: { revokedAt: options.now() },
      });
      await options.securityEvents?.({ type: "logout", userId: principal.userId });
    } catch (error) {
      if (!(error instanceof AuthenticationError)) throw error;
    }

    clearSessionCookies(reply, cookieNames, options.production);
    return reply.status(204).send();
  });

  app.get("/api/v1/me", async (request, reply) => {
    const principal = await getPrincipal(request, cookieNames, options);
    refreshSessionCookie(request, reply, principal.idleExpiresAt, cookieNames, options);
    const user = await withUserTransaction(
      options.database,
      principal.userId,
      (transaction) =>
        transaction.user.findUniqueOrThrow({
          where: { id: principal.userId },
          include: { memberships: { include: { organization: true } } },
        }),
    );

    return {
      user: { id: user.id, email: user.email, displayName: user.displayName },
      memberships: user.memberships.map((membership) => ({
        organizationId: membership.organizationId,
        organizationName: membership.organization.name,
        role: membership.role,
      })),
    };
  });

  app.get("/api/v1/organizations/:organizationId/context", async (request, reply) => {
    const principal = await getPrincipal(request, cookieNames, options);
    refreshSessionCookie(request, reply, principal.idleExpiresAt, cookieNames, options);
    const { organizationId } = organizationSchema.parse(request.params);
    return { tenant: await resolveTenantContext(options.database, principal.userId, organizationId) };
  });
}

function getCookieNames(production: boolean): CookieNames {
  return production
    ? { session: "__Host-issuespan-session", csrf: "__Host-issuespan-csrf" }
    : { session: "issuespan-session", csrf: "issuespan-csrf" };
}

function getPrincipal(
  request: FastifyRequest,
  cookies: CookieNames,
  options: AuthRouteOptions,
  refresh = true,
) {
  return authenticateSession(options.database, request.cookies[cookies.session], options.now(), refresh);
}

function setSessionCookies(
  reply: FastifyReply,
  token: string,
  idleExpiresAt: Date,
  names: CookieNames,
  options: AuthRouteOptions,
): void {
  const maxAge = Math.max(0, Math.floor((idleExpiresAt.getTime() - options.now().getTime()) / 1000));
  const common = { path: "/", secure: options.production, sameSite: "lax" as const };
  reply.setCookie(names.session, token, { ...common, httpOnly: true, maxAge });
  reply.setCookie(names.csrf, randomBytes(32).toString("base64url"), { ...common, httpOnly: false, maxAge });
}

function refreshSessionCookie(
  request: FastifyRequest,
  reply: FastifyReply,
  expiresAt: Date,
  names: CookieNames,
  options: AuthRouteOptions,
): void {
  const token = request.cookies[names.session];
  if (token) setSessionCookies(reply, token, expiresAt, names, options);
}

function clearSessionCookies(reply: FastifyReply, names: CookieNames, production: boolean): void {
  const common = { path: "/", secure: production, sameSite: "lax" as const };
  reply.clearCookie(names.session, { ...common, httpOnly: true });
  reply.clearCookie(names.csrf, { ...common, httpOnly: false });
}

function requireBrowserMutation(
  request: FastifyRequest,
  names: CookieNames,
  trustedOrigins: readonly string[],
): void {
  const origin = request.headers.origin;
  if (!origin || !trustedOrigins.includes(origin)) throw new AuthorizationError("Invalid origin");
  const headerToken = request.headers["x-csrf-token"];
  const cookieToken = request.cookies[names.csrf];
  if (typeof headerToken !== "string" || !cookieToken || headerToken !== cookieToken) {
    throw new AuthorizationError("CSRF validation failed");
  }
}
