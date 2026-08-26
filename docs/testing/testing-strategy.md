# Testing and quality engineering

Status: **CURRENT quality baseline; IS-14 and IS-33 provide real PostgreSQL evidence.**

The purpose of testing is executable evidence for architecture guarantees, not a coverage contest. IssueSpan has many fast domain tests, substantial real-infrastructure tests at PostgreSQL/Valkey/queue/provider boundaries, and a small number of expensive browser journeys.

## Portfolio

| Layer | Tool / environment | Proves |
| --- | --- | --- |
| Static | TypeScript, ESLint, boundary checks | imports, contracts, forbidden dependencies |
| Domain | Vitest | value objects, aggregate behavior, invariants |
| Application | Vitest + real DB | use-case authorization and transactions |
| Repository | Testcontainers PostgreSQL 18 | constraints, RLS, indexes, locking, migrations |
| Queue | Testcontainers Valkey + BullMQ | claims, retries, duplicate jobs, fairness |
| API | Fastify inject + real DB | status, Problem Details, persistence, isolation |
| Contract | OpenAPI and generated client | schema compatibility and drift |
| Provider | deterministic adapters/fake servers | signatures, retries, mapping, dedupe |
| Browser | Playwright | accessible golden paths and realtime UX |
| Performance | k6 and channel soak | saturation, latency tails, reconnect capacity |
| Security | negative corpus and role tests | XSS, SSRF, BOLA, CSRF, tenant boundaries |

SQLite is not a substitute for PostgreSQL: it cannot prove RLS, `SKIP LOCKED`, UUIDv7 behavior, composite constraints, or production transaction semantics. Testcontainers is the default for repository and integration evidence.

IS-14 currently runs `pnpm db:validate`, `pnpm db:generate`, `pnpm db:migrate`, and `pnpm db:test` against PostgreSQL 18. The test command uses `DATABASE_TEST_URL` when supplied so a clean database can be exercised; the CI lane provisions the Compose PostgreSQL service. IS-33 adds a Fastify-inject integration test that uses the same real database through the restricted runtime role for login, `/me`, and TenantContext authorization. IS-34 adds database-free Identity application tests, API security tests for expiry/revocation/Origin/CSRF and response redaction, and a dedicated authentication CI lane. This is CURRENT evidence for the database and authentication boundary, not completion of the future queue, provider, or browser lanes.

## Deterministic test design

Builders use explicit Organization and User IDs. Factories are small and deterministic; random Faker data is reserved for properties that need it. Inject a Clock and ID generator into application code so retries and timestamps can be reproduced. Each test worker receives a unique database/schema, or tests are serialized initially. Transaction rollback is not universal because workers use independent connections.

BullMQ tests use real Valkey with unique queue prefixes. Fixtures never contain customer data, live Zapo credentials, or real provider accounts. A live-provider smoke test is separate, manual or scheduled, and never part of ordinary PR CI.

## Critical correctness tests

### Outbox and idempotency

- Message and Outbox commit together, or neither commits.
- A relay crash after publish produces duplicate delivery but one logical consumer effect.
- Many concurrent inbound events with the same `(organization_id, channel_connection_id, provider_message_id)` create exactly one Message.
- Replayed integration events are safe.
- Provider acceptance followed by process crash produces `DELIVERY_UNKNOWN` or reconciliation, never an invented `SENT` guarantee.

### Tenant isolation and RLS

For every tenant-owned resource, run a matrix for list, read, create, relationship create, update, delete, and job execution. Use a known foreign UUID and assert `404` or no side effect. Run direct RLS tests with `issuespan_app`; assert it is not superuser, `BYPASSRLS`, or table owner. Test transaction-local context with a pooled connection.

### Authorization and web security

Data-driven RBAC tests cover capabilities, last-owner removal, Admin self-promotion, invitation role grants, session revocation, and high-risk re-authentication. CSRF tests cover valid token, missing token, wrong Origin, and same-site navigation. Response schemas prove password hashes, provider credentials, Zapo keys, cookies, and raw payloads never leak.

Security corpora include malicious email HTML (`script`, `onerror`, `javascript:`, SVG, remote images), SSRF URLs (localhost, IPv6 loopback, encoded private IPs, DNS-to-private, metadata IP, redirects, credentials, non-HTTPS), oversized archives, path traversal, and malformed Problem Details.

## Provider and Zapo scenarios

Provider contract tests cover signature verification over the raw body, duplicate delivery ID, out-of-order webhook, rate limit, timeout, malformed response, and status mapping to `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CANCELED`, or `UNKNOWN`. `UNKNOWN` is preferable to a false mapping.

The Zapo fake server covers pair/connect, restart without QR, inbound `fromMe`, server ACK, delivered/read receipts, reconnect, disconnect, logout, history sync, duplicate events, and `message_unavailable` followed by recovery. Ownership tests cover competing acquisition, expiry, generation fencing, A-pauses/B-takes-over split brain, lost renewal shutdown, bounded reconnect concurrency, and graceful handoff.

Email tests cover reply token routing, `In-Reply-To`, `References`, forwarded messages, subject ambiguity, provider Message ID versus RFC Internet Message-ID, multiple participants, bounce/complaint suppression, attachment scanning states, and mail-loop detection.

## Browser and system journeys

Playwright golden paths include: receive and send a WhatsApp Message; add an InternalNote; create an Escalation; see shared CustomerAccount impact; observe provider resolution and follow-up-needed; send Email; inspect a connection incident; simulate reconnect and recovery. Tests use semantic locators, isolated Organizations, no arbitrary sleeps, and trace artifacts on failure. CI runs Chromium on PR; nightly/release runs Chromium, Firefox, and WebKit.

SSE tests assert that events are identity/signal only, tenant-filtered, coalesced under storms, and followed by REST refetch after reconnect. The browser must never claim an external send succeeded from optimistic state alone.

## Migration, failure, and performance tests

Migrations run empty→head and representative previous-release→head. Expand/backfill/contract compatibility is tested across mixed versions; down-migration is not assumed. Failure injection covers database restart, Valkey delay, provider timeout/429/5xx, object-storage failure, duplicate/out-of-order webhook, crash after publish, lease expiry, and graceful shutdown.

k6 profiles are baseline, arrival-rate load, stress, spike, soak, and failover. Channel soak records RSS, heap, external memory, event-loop delay, reconnects, garbage collection, file descriptors, and sockets. A benchmark reports its Git SHA, image digest, Node version, instance/task sizes, PostgreSQL/Valkey versions, dataset, script, and telemetry; it does not make universal capacity claims.

## CI lanes and quality policy

PR lanes: install with frozen lockfile, lint, typecheck, unit, integration, tenant/RLS, OpenAPI/client, security corpus, Docker build, container scan, CodeQL, and dependency review. Nightly/release lanes add all browsers, provider sandbox, high concurrency, long Zapo soak, migration upgrade, performance, restore, and chaos experiments.

Coverage is a signal. A provisional lesson target is 80% line/function/statement and 75% branch, with higher branch attention in authorization and tenant code; the repository may refine numbers after a baseline. Risk coverage overrides raw percentages. A flaky test is a defect. Quarantine requires an issue, owner, deadline, and explicit exclusion; critical security, tenant, migration, and persistence tests are never silently skipped.

Definition of Done includes changed-behavior tests, tenant/security review, failure semantics, docs/ADR updates when decisions change, observability fields, migration compatibility, and a clean diff. The concise explanation is: “Mocks prove local decisions; real infrastructure proves the boundaries where IssueSpan can lose data, cross a tenant, duplicate a provider effect, or split ownership.”
# IS-15 authentication coverage

Status: **CURRENT unit/API/CI evidence; broader authentication coverage remains PLANNED.**

`packages/identity/src/index.test.ts` covers Argon2id verification, wrong-password rejection, encoded-policy rehash detection, 256-bit opaque token generation, token hashing, and fail-closed capability authorization. `packages/identity/src/application.test.ts` covers idle/absolute expiry, revoked/inactive sessions, and idle refresh caps. `apps/api/src/app.test.ts` is CURRENT evidence for HttpOnly cookies, stable CSRF refresh, wrong-Origin/missing-CSRF rejection, server-side revocation, and safe security events/responses. `apps/api/src/runtime.integration.test.ts` is CURRENT real-PostgreSQL evidence for the restricted role, login, `/me`, valid Membership-derived TenantContext, and non-member denial. `.github/workflows/authentication.yml` runs the database, Identity, API, and root typecheck checks together.
