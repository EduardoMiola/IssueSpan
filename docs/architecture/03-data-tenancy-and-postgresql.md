# Data, tenancy, and PostgreSQL

Status: **CURRENT baseline; planned implementation.**

This document defines the first persistence model for IssueSpan. Tenant isolation is a chain of independent controls, and every link must be testable.

## Decision

IssueSpan starts with one PostgreSQL database and shared tables. Every tenant-owned row carries an explicit `organization_id`. Application scoping is the primary programming model; PostgreSQL row-level security (RLS), composite foreign keys, restricted roles, and negative tests provide defense in depth.

The evolution path is shared tables → HA/read replicas → tenant cells or dedicated databases for measured enterprise needs. Partitioning and sharding are deferred until query plans, connection pressure, write volume, and cost demonstrate the need.

Related ADR: [ADR-0003](../adr/0003-shared-postgres-tenancy-rls.md).

## Tenant context chain

```text
request
  → authenticate User
  → resolve selected Organization from membership
  → build server-derived TenantContext
  → authorize capability
  → call tenant-aware application service
  → call tenant-aware repository
  → execute transaction with local RLS setting
  → constraints and RLS enforce the final boundary
```

`TenantContext` contains at least `organizationId`, `userId`, and effective permissions. It is derived from the authenticated session and membership. A body or query parameter naming an organization is a selector, never authority. An inaccessible resource normally behaves as `404` to avoid cross-tenant enumeration.

Jobs, cache keys, object-storage keys, search documents, SSE topics, audit events, and provider connections carry the same organization identity. A missing tenant field is a design error, not a convenience default.

## Identifier and ownership policy

UUIDv7 is the default. PostgreSQL 18 provides native `uuidv7()`; application-generated UUIDv7 is acceptable when an ID is needed before insertion. UUIDv7 gives global uniqueness and time locality for B-tree indexes, at the cost of 16-byte keys and timestamp leakage. An ID is never an authorization credential.

Users may be global identities. Membership is organization-scoped:

```sql
membership(
  organization_id uuid not null references organization(id),
  user_id         uuid not null references app_user(id),
  role            text not null,
  status          text not null,
  unique (organization_id, user_id)
)
```

The same person may be `OWNER` in one Organization and `AGENT` in another; role does not belong on `User`.

## Composite tenant-aware relationships

Tenant-owned references include the tenant where a relationship crosses aggregates:

```sql
messages(
  organization_id uuid not null,
  id uuid not null,
  conversation_id uuid not null,
  primary key (organization_id, id),
  foreign key (organization_id, conversation_id)
    references conversations(organization_id, id)
)
```

This prevents a buggy service from linking a message in Organization A to a conversation in Organization B. The tradeoff is wider indexes, more storage, and more columns in joins. Repositories must still include explicit tenant predicates.

## RLS roles and transaction scope

The migration role owns DDL. The runtime role is `NOSUPERUSER`, `NOBYPASSRLS`, and does not own application tables. RLS is enabled on sensitive tenant tables. `USING` controls visibility; `WITH CHECK` controls inserted and updated rows. Enabling RLS without a policy is default deny.

The organization setting is transaction-local:

```sql
select set_config('app.organization_id', $1, true);
```

It must be set inside the same transaction that reads or writes data. Session-level settings are unsafe with connection pooling. The application still passes explicit organization predicates: RLS is a backstop, not an excuse for ambiguous repositories.

Superusers, `BYPASSRLS`, and table owners can defeat RLS. Tests must assert that `issuespan_app` is not any of those. Production access to the migration role is separately controlled and audited.

## Inbound message transaction

Inbound delivery is one durable unit of work with no external network call:

```text
verify provider and resolve ChannelConnection
  → insert dedupe key (or return existing result)
  → resolve/create Contact
  → resolve/open Conversation
  → insert Message
  → reopen/update last_activity_at if policy requires
  → append outbox event and audit facts
  → commit
```

The final arbiter for duplicate delivery is a database unique constraint, for example `unique (organization_id, channel_connection_id, provider_message_id)`. “Select, then insert” is not sufficient under concurrent webhook delivery.

Keep `provider_timestamp`, `received_at`, and `created_at` separate. For `message_unavailable`, create a placeholder with `content_state = 'UNAVAILABLE'`; a later event with the same provider ID upgrades that Message. History sync uses the same ingest pipeline as live events.

## Query shapes and pagination

Indexes start with `organization_id` and follow actual predicates:

```sql
create index conversations_inbox_idx
  on conversations (organization_id, status, last_activity_at desc, id desc);
```

A partial active index may be better after measurement. Validate with `EXPLAIN (ANALYZE, BUFFERS)` against representative tenant skew. Keyset pagination uses `(last_activity_at, id) < (cursor.last_activity_at, cursor.id)`. The cursor is opaque; base64 is not encryption.

## Transactions, locking, and deletion

The baseline isolation level is `READ COMMITTED`, supported by constraints, short transactions, and idempotency. Use narrow locks or optimistic version checks for specific invariants; raise isolation only when measured need justifies it. Never hold a transaction while calling Zapo, GitHub, Postmark, or object storage.

There is no universal soft-delete rule. Use explicit states where history remains meaningful. Soft-delete only when recovery, retention, and uniqueness behavior are defined. Tenant deletion must cover PostgreSQL, object storage, provider state, cache, jobs, and future search projections; audit evidence may require restricted metadata retention without content.

## Operational constraints

The connection budget is global across API replicas, workers, channel workers, migrations, and administration. A future PgBouncer transaction pool must be checked against transaction-local RLS settings and prepared statements. Migrations connect directly with the migrator role.

PostgreSQL is durable truth. Redis/Valkey is for ephemeral cache, queue coordination, and realtime signals. Object storage holds attachment bytes, while metadata and authorization remain in PostgreSQL.

## Failure modes and tests

- Missing TenantContext: reject before repository access.
- Cross-tenant foreign key: composite FK rejects the write.
- RLS context leak: transaction-local setting prevents reuse; test pooled connections.
- Duplicate inbound event: unique constraint leaves one Message and one logical outbox effect.
- Pool exhaustion: alert on connection wait, active/idle counts, and transaction age.
- Slow query or skew: capture plans and tenant distribution before adding cache or sharding.

The reusable isolation matrix covers list, read, create, relationship create, update, delete, and job execution for every tenant-owned aggregate. Repository tests use real PostgreSQL, not SQLite.

## Evolution and interview mental model

Start with one database because it makes transactions, migrations, and local development understandable. Add cells only when a measurable tenant, availability, or capacity boundary requires them. The short explanation is: “The application scopes every operation by a server-derived Organization, composite FKs stop cross-tenant links, and RLS is a final deny-by-default backstop. PostgreSQL is truth; caches and queues are replaceable.”
