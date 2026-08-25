# ADR-0015: Database foundation and tenancy implementation

Status: ACCEPTED

## Context

IS-14 is the first runtime persistence slice. The repository has a PostgreSQL 18 local service but no application packages yet. Tenant isolation must be enforceable before application repositories exist and must remain compatible with the shared-table/RLS decision in ADR-0003.

## Decision

Implement `packages/database` with Prisma 7's ESM `prisma-client` generator and PostgreSQL driver adapter. Use PostgreSQL 18 native `uuidv7()`, shared tables with explicit `organization_id`, composite tenant foreign keys, and transaction-local `app.organization_id`. Migrations run through the database owner; `issuespan_app` is a separate non-superuser, `NOBYPASSRLS` role that does not own application tables. RLS policies include both `USING` and `WITH CHECK` and therefore fail closed when tenant context is absent.

The package exports only `createDatabaseClient`, `withTenantTransaction`, `TenantContext`, and the generated Prisma client. The first migration creates the outbox table but not a relay or BullMQ integration. The current real-PostgreSQL test lane uses the existing Compose PostgreSQL 18 service; isolated Testcontainers workers remain planned.

## Consequences

Every future tenant-owned use case must enter through `withTenantTransaction` or an equivalent reviewed adapter. A pooled connection cannot retain tenant authority after a transaction. Runtime role credentials are local examples only; deployment provisioning and secret rotation are deferred to the deployment slices.
