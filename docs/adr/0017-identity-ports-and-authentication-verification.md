# ADR-0017: Identity ports and authentication verification

Status: ACCEPTED

## Context

The initial authentication implementation mixed Identity policy with Prisma persistence and left several security cases outside CI. That made the boundary difficult to read and allowed persistence changes to affect authentication policy directly.

## Decision

`packages/identity` owns database-free contracts, ports, pure policy, and the application service. `apps/api/src/identity-adapter.ts` is the composition/infrastructure boundary: it maps Prisma records to Identity DTOs and delegates tenant-scoped work to the database transaction helpers. HTTP routes depend only on `IdentityService`.

Identity tests cover idle and absolute expiry, revoked and inactive sessions, and bounded idle refresh. API tests cover Origin and CSRF enforcement, revocation, stable CSRF refresh, response redaction, and security-event redaction. A dedicated authentication workflow provisions PostgreSQL 18 and runs database validation/generation/migrations, restricted-role integration tests, Identity/API tests, and the explicit root typecheck.

## Consequences

Authentication policy can be tested without Prisma, while the real adapter and restricted database role remain covered by integration tests. The workflow is intentionally scoped to authentication/database changes; broader browser, provider, and security-corpus lanes remain planned.

## Alternatives

Keeping Prisma imports in Identity would reduce file count but preserve coupling and make the architecture rule unenforceable. Running only mocked API tests would be faster but would not prove the RLS-backed adapter.
