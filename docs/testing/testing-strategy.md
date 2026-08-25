# IssueSpan testing strategy

**Status:** Frozen quality strategy.

~~~text
Playwright/smoke → API/provider contracts → Testcontainers integration → domain/idempotency units
~~~

Required coverage: domain invariants and capabilities; tenant-scoped repositories; API validation/errors/sessions; outbox atomicity and replay; duplicate jobs/webhooks; fake Zapo inbound/outbound/receipts/reconnect; provider fixtures; SSE reconnect; inbox/assignment/escalation failure recovery; migrations; accessibility; production build.

Fixtures are deterministic, synthetic, and organization-explicit. Never use real customer data, tokens, sessions, or unsanitized production payloads.

Exercise provider timeout, duplicates, queue retry, worker crash window, stale lease/fencing, deadlock, webhook replay, rate limits, malformed attachments, unauthorized membership, and SSE reconnect. PR gates are format/lint, typecheck, unit, focused integration/contracts, security checks, and build. Green means only the executed scope passed; it does not prove capacity or tenant isolation.
