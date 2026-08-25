# ADR-0003: Shared Postgres tenancy with RLS defense in depth

Status: ACCEPTED

## Decision

Use shared tables with `organization_id`, server-derived TenantContext, composite tenant-aware constraints, and PostgreSQL RLS. The application role cannot bypass runtime policies.

## Consequences

Pooling and transaction-local settings require tests. This maximizes early simplicity while preserving a path to cells or dedicated databases later.
