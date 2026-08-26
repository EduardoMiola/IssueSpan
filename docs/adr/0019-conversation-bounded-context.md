# ADR-0019: Conversation bounded context boundaries

Status: ACCEPTED

## Context

IS-17 is the first product bounded context after the database and Identity foundations. Conversations must model lifecycle decisions without coupling domain/application code to Prisma, Fastify, BullMQ, or a provider SDK, while tenant-owned persistence must still run under the restricted runtime role and RLS.

## Decision

`packages/conversations` separates the Conversation aggregate and Message relationship, application use cases, ports, and Prisma infrastructure adapters. `ConversationApplicationService` requires a server-derived TenantContext for every tenant-owned operation, persists through repository ports, and emits domain events. Messaging is a port; provider delivery and transactional outbox orchestration remain later work.

Conversation transitions are explicit: `OPEN` and `PENDING` can resolve, only `RESOLVED` can reopen, and only `OPEN` can become `PENDING` for an outbound reply. Inbound messages record activity without allowing a caller to supply a different organization. The Prisma adapter delegates every tenant operation to `withTenantTransaction`.

`tools/check-boundaries.mjs` is a reusable CI check for Identity and Conversations domain/application imports. It fails on database, runtime, or provider infrastructure imports and runs before typechecking in the relevant workflows.

## Consequences

The domain can be tested deterministically without a database, while adapter integration tests prove RLS behavior against PostgreSQL. Conversation delivery is not yet durable or provider-backed; those concerns belong to IS-19 and later messaging work.
