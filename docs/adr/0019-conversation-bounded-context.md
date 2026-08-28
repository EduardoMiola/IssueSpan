# ADR-0019: Conversation bounded context boundaries

Status: ACCEPTED

## Context

IS-17 is the first product bounded context after the database and Identity foundations. Conversations must model lifecycle decisions without coupling domain/application code to Prisma, Fastify, BullMQ, or a provider SDK, while tenant-owned persistence must still run under the restricted runtime role and RLS.

## Decision

`packages/conversations` separates the Conversation aggregate and Message relationship, application use cases, ports, and Prisma infrastructure adapters. `ConversationApplicationService` requires a server-derived TenantContext for every tenant-owned operation, persists through repository ports, and emits domain events. A persistence unit-of-work port keeps Message insertion and Conversation activity/lifecycle updates in one restricted-role tenant transaction. Messaging is a port; provider delivery and transactional outbox orchestration remain later work.

Conversation transitions are explicit: `OPEN` and `PENDING` can resolve, only `RESOLVED` can reopen, and only `OPEN` can become `PENDING` for an outbound reply. Inbound messages record activity without allowing a caller to supply a different organization. The Prisma adapter delegates every tenant operation to `withTenantTransaction`.

`tools/check-boundaries.mjs` is a reusable CI check for Identity and Conversations source code, including nested domain, application, ports, and public paths. Its tested rules permit persistence dependencies only in infrastructure adapters while rejecting runtime and provider coupling throughout the bounded context, and run before typechecking in the relevant workflows.

## Consequences

The domain can be tested deterministically without a database, while adapter integration tests prove RLS behavior against PostgreSQL. Conversation delivery is not yet durable or provider-backed; those concerns belong to IS-19 and later messaging work. Until IS-19 replaces the post-commit messaging and event-port requests with transactional outbox intents, a port failure can occur after conversation state has committed. Callers must not interpret a successful boundary request as provider delivery confirmation.
