# Architecture Decision Records

ADRs use a lightweight MADR format: title, status, context, decision, alternatives, consequences, and revisit trigger. Statuses are PROPOSED, ACCEPTED, SUPERSEDED, or REJECTED. An ADR records a decision; deep architecture documents explain how to apply it. Jira tracks delivery and does not replace either.

## Index

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-modular-monolith-ports-adapters.md) | Modular monolith + Ports & Adapters | ACCEPTED |
| [0002](0002-runtime-process-separation.md) | Separate runtime processes | ACCEPTED |
| [0003](0003-shared-postgres-tenancy-rls.md) | Shared Postgres tenancy + RLS | ACCEPTED |
| [0004](0004-opaque-server-sessions.md) | Opaque server-side sessions | ACCEPTED |
| [0005](0005-transactional-outbox.md) | Outbox + at-least-once/idempotency | ACCEPTED |
| [0006](0006-sse-v01.md) | SSE for v0.1 realtime | ACCEPTED |
| [0007](0007-zapo-messaging-channel.md) | Zapo behind MessagingChannel | ACCEPTED |
| [0008](0008-zapo-ownership-leases.md) | One active Zapo owner + leases | ACCEPTED |
| [0009](0009-local-engineering-issue-links.md) | Local issue + external links | ACCEPTED |
| [0010](0010-email-postmark-v1.md) | Email v1 via Postmark | ACCEPTED |
| [0011](0011-opentelemetry-first.md) | OpenTelemetry-first observability | ACCEPTED |
| [0012](0012-docker-aws-opentofu-actions.md) | Docker/AWS/OpenTofu/Actions | ACCEPTED |
| [0013](0013-build-once-promote-digest.md) | Build once, promote digest | ACCEPTED |
| [0014](0014-agpl-only-proposed.md) | AGPL-3.0-only proposed license | PROPOSED — legal review required |
| [0015](0015-database-foundation-tenancy-implementation.md) | IS-14 database foundation and tenancy implementation | ACCEPTED |
| [0016](0016-restricted-api-runtime-and-membership-proof.md) | Restricted API runtime and Membership proof | ACCEPTED |
| [0017](0017-identity-ports-and-authentication-verification.md) | Identity ports and authentication verification | ACCEPTED |
| [0018](0018-tooling-runtime-baseline.md) | Tooling and runtime baseline | ACCEPTED |

## Prior decision groups

Architecture/domain/data, auth, messaging/channel, observability/API, engineering/Email, security/testing, deployment, and OSS governance are covered by the index above and the linked deep documents. Add an ADR when a decision changes a boundary, invariant, security property, external contract, data migration, operational procedure, or licensing obligation.
