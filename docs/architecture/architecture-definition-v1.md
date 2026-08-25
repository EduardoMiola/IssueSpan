# IssueSpan Architecture Definition v1

Status: **FROZEN planning baseline for PR #1.** This document defines direction, not implemented runtime behavior.

IssueSpan is a modular monolith using Ports & Adapters, one shared Postgres database with tenant-aware ownership and RLS defense in depth, and separate runtime processes: `web`, `api`, `worker`, and `channel-worker`. The baseline technology is TypeScript, React/Vite, PostgreSQL, Valkey/BullMQ, object storage, OpenTelemetry/Pino, Docker/OCI, AWS ECS, OpenTofu, and GitHub Actions.

Bounded contexts are Identity & Access, Workspace, Customer Context, Conversation, Messaging, Escalations, and Audit. Organizations are tenants. TenantContext is server-derived. Business state and event intent commit together; asynchronous delivery is at-least-once and idempotent. Zapo/WhatsApp is v0.1's flagship channel behind MessagingChannel. Email is v1 through a managed provider, Postmark first. Provider-native engineering facts stay with GitHub/Linear/Jira; IssueSpan owns customer impact.

Invariants: no cross-tenant read/write; no direct provider SDK leakage into domain; no external side effect inside the request transaction; no claim of exactly-once external delivery; no automatic Conversation resolution from engineering status; one active owner per Zapo session; secrets and customer content are not logged by default; migrations support overlapping versions.

Deployment direction is ECS with API/general workers on Fargate and stateful channel-worker capacity on ECS/EC2 as justified, RDS Postgres Multi-AZ, ElastiCache/Valkey, S3, Secrets Manager, and immutable GitHub Actions-built images promoted by digest.

Deep documents: [fundamentals](01-fundamentals-and-system-shape.md), [DDD](02-domain-ddd-and-module-boundaries.md), [data](03-data-tenancy-and-postgresql.md), [auth](04-authentication-authorization-rbac.md), [messaging](05-messaging-event-driven-reliability.md), [Zapo](06-zapo-channel-workers-and-session-ownership.md), [operations](07-api-contracts-observability-and-operations.md), [engineering](08-engineering-integrations-and-customer-impact.md), [Email](09-email-channel-architecture.md), and [frontend](10-frontend-and-product-ux.md).
