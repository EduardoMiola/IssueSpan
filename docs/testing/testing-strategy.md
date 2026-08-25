# Testing strategy

Status: **CURRENT quality baseline; implementation planned alongside each slice.**

The pyramid is adapted to failure boundaries: fast domain/unit tests; application/repository integration tests with real Postgres, Valkey, and Testcontainers; adapter/contract tests; provider-shaped E2E; and a small Playwright golden path. Tests must prove behavior and isolation, not merely line coverage.

Unit tests cover value objects, aggregate transitions, authorization policies, status mapping, retry classification, cursors, and invariant failures. Integration tests use real constraints, transactions, RLS, leases, outbox claiming, and migrations. The negative matrix attempts missing context, wrong organization, cross-tenant IDs, revoked sessions, last-owner removal, replayed webhook, duplicate outbox, stale generation, and expired token.

Zapo uses a deterministic fake server for connect, disconnect, logout, ACK, reconnect, duplicate event, stale worker, and handoff scenarios. Postmark/provider tests use deterministic fixtures and contract mocks; live providers never run in normal PR CI. OpenAPI drift and generated-client checks fail when contracts diverge.

Chaos examples include Postgres restart between transaction and relay, worker crash after publish, Valkey delay, provider 429/5xx, webhook duplication/out-of-order delivery, lease expiry during pause, and ambiguous external acceptance. k6 profiles are steady, spike, soak, and breakpoint. Performance tests report workload assumptions rather than invented universal numbers.

Definition of Done: tests for changed behavior; docs and ADR review when applicable; tenant/security impact considered; traces/metrics/log fields added; migration is expand/backfill/contract safe; failure and retry semantics are explicit; PR links Jira; unrelated changes remain untouched. Anti-patterns include testing only mocks, using real customer/provider data, asserting implementation details, sleeping for timing, and treating a 204/prevalidation as persistence success.
