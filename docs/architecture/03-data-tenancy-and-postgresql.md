# Data, tenancy, and PostgreSQL

Status: **CURRENT baseline; planned implementation.**

## Tenant model

IssueSpan starts with a shared database and shared tables. Every tenant-owned row carries `organization_id`; global reference data is explicitly marked global. The API derives `TenantContext` from the authenticated session and membership, never from an untrusted body field or a client-selected organization header.

The application supplies a transaction-local PostgreSQL setting with `set_config('app.organization_id', $id, true)`. The `true` scope matters: a pooled connection must not retain one tenant's setting for the next request. PostgreSQL RLS is defense in depth, not a replacement for application authorization. Policies deny tenant rows unless the transaction context matches.

## Keys and constraints

UUIDv7 is the planned identifier default: it keeps UUID portability while providing time locality useful for indexes and operational sorting. It leaks approximate creation time and depends on implementation quality, so it is not a security boundary. Random UUIDv4 remains acceptable where temporal locality is not useful.

Tenant-aware relationships use composite foreign keys such as `(organization_id, conversation_id)` to prevent a row from tenant A referring to a same-shaped identifier in tenant B. Unique constraints include `organization_id` unless the invariant is intentionally global. Dedupe keys are stored with a scope that matches the provider's identity: organization, channel connection, provider event ID, or message direction as appropriate.

Use constraints for uniqueness, valid states, and referential integrity. Use `READ COMMITTED` by default. Add optimistic concurrency with a version/ETag, row locks for narrow ownership claims, and serializable transactions only for a demonstrated invariant that cannot be expressed otherwise.

## Roles and RLS operation

The migrator role owns DDL and policies. The application role has only runtime DML and cannot disable RLS or create arbitrary tables. Administrative support paths must be explicit, audited, and tenant-scoped. Tests must prove that a missing tenant context fails closed and that a transaction cannot read or mutate another organization.

## Query shape

Indexes begin with tenant-leading access patterns: `(organization_id, created_at, id)`, status queues, active/non-deleted rows, and provider dedupe keys. Prefer keyset pagination using an opaque cursor over large offsets. Partial indexes such as `WHERE deleted_at IS NULL` are useful when soft-deleted rows are retained. Every list endpoint has a bounded page size and a predictable order.

Soft delete is not universal. Use it when auditability or user recovery requires retention, enforce filtered uniqueness, and define purge/retention separately. Do not call a soft-deleted customer “gone” while references and privacy obligations remain unresolved.

## Pooling and evolution

Connection budgets are calculated per API replica, worker, and channel worker—not configured independently until Postgres is exhausted. PgBouncer is a later option after verifying transaction-local settings, prepared statement behavior, and transaction boundaries. Future steps are RDS HA, read replicas for safe projections, partitioning of proven hot tables, tenant cells, and dedicated databases for exceptional enterprise/isolation needs. None are implied to exist in v0.1.
