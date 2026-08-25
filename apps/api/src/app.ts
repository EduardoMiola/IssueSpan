import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import type { PrismaClient } from "@issuespan/database";
import type { SecurityEventSink } from "@issuespan/identity";
import { registerAuthRoutes } from "./auth-routes.js";
import { handleApiError } from "./problem-details.js";

type AppOptions = {
  database: PrismaClient;
  production?: boolean;
  trustedOrigins: readonly string[];
  now?: () => Date;
  securityEvents?: SecurityEventSink;
};

/** Builds the API composition root without starting a network listener. */
export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({ logger: false });
  const production = options.production ?? process.env.NODE_ENV === "production";
  const now = options.now ?? (() => new Date());

  app.register(cookie);
  app.register(cors, {
    credentials: true,
    origin: (origin, callback) => {
      callback(null, !origin || options.trustedOrigins.includes(origin));
    },
  });

  app.setErrorHandler((error, _request, reply) => handleApiError(error, reply));
  registerAuthRoutes(app, { ...options, production, now });

  return app;
}
