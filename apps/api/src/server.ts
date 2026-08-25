import { createDatabaseClient } from "@issuespan/database";
import { buildApp } from "./app.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const origins = (process.env.TRUSTED_APP_ORIGINS ?? "http://localhost:5173").split(",").map((origin) => origin.trim()).filter(Boolean);
const app = buildApp({ database: createDatabaseClient(url), trustedOrigins: origins, production: process.env.NODE_ENV === "production", securityEvents: (event) => console.info(JSON.stringify({ event: event.type, userId: event.userId, organizationId: event.organizationId })) });
await app.listen({ host: process.env.HOST ?? "127.0.0.1", port: Number(process.env.PORT ?? 3000) });
