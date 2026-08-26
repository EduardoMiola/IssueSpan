# ADR-0016: Restricted API runtime and transaction-local Membership proof

Status: ACCEPTED

## Context

IS-33 found that the API used migration-owner credentials and resolved Membership before RLS scope existed. Merely switching credentials would make tenant resolution fail closed, while continuing with owner credentials would bypass the intended database defense.

## Decision

The running API requires `DATABASE_APP_URL` and connects only as the restricted `issuespan_app` role. `DATABASE_URL` remains migration/admin-only.

`withTenantTransaction` accepts an authenticated user plus a client-selected organization, establishes transaction-local `app.organization_id` and `app.user_id`, proves the matching Membership under RLS, constructs TenantContext, and only then invokes application work in that same transaction. A non-member never receives a transaction callback.

`withUserTransaction` establishes only `app.user_id` so `/me` can list the authenticated user's own Membership rows. A separate `FOR SELECT` Membership policy permits self-reads through user scope. The tenant policy alone governs inserts, updates, and deletes, so user scope can never authorize a write.

The Prisma schema explicitly maps its camelCase fields to the existing snake_case columns. This is a client-schema correction, not a database rename or an additional DDL change.

## Consequences

Tenant selectors are not authority, missing context fails closed, and migration credentials are unnecessary at runtime. Identity ports/adapters and wider authentication CI remain tracked separately in IS-34.
