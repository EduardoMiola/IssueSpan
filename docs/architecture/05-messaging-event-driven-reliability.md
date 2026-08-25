# Messaging, events, and reliability

Status: **CURRENT baseline; planned implementation.**

## Vocabulary

- A **command** asks IssueSpan to do something and may be rejected by policy.
- A **domain event** records a fact inside a bounded context.
- An **integration event** is a versioned fact safe to publish across a boundary.
- A **job** is durable work that may be retried.

An event envelope carries `event_id`, `event_type`, `version`, `occurred_at`, `organization_id`, `aggregate_type`, `aggregate_id`, `correlation_id`, and `causation_id`. Payloads are versioned and contain no secrets or unnecessary transcript content.

## Inbound messages

Provider webhooks/events enter through an adapter, are authenticated, normalized, and deduplicated before application behavior. A duplicate provider event is a successful no-op with a traceable outcome. `message_unavailable` means the provider event was accepted but its body cannot currently be obtained; the system records the durable fact, retries retrieval under a bounded policy, and exposes an incident rather than inventing message content.

## Outbound pipeline

```text
API transaction
  └─ Message(QUEUED) + OutboxEvent(PENDING)
       └─ relay claims with lease/SKIP LOCKED
            └─ BullMQ job (at-least-once)
                 └─ general worker / channel-worker
                      └─ provider adapter
                           └─ provider ACK → Message(SENT)
```

The API returns `201 Created` for the durable queued Message resource. `SENT` for Zapo means the provider acknowledged acceptance, not that a recipient read it. Exactly-once delivery is impossible at the external side-effect boundary: a process can lose its response after the provider accepts a message. Use provider idempotency where supported, local dedupe keys, and an `AMBIGUOUS` outcome when certainty is unavailable.

The outbox relay leases rows, uses `FOR UPDATE SKIP LOCKED`, publishes, and records attempts. A crash between publish and marking sent creates a duplicate-publish window; consumers and handlers must be idempotent. BullMQ is at-least-once, not a correctness guarantee.

## Errors and retry

Classify failures as retryable, terminal, deferred, or ambiguous. Retry transient network/5xx/rate-limit failures with exponential backoff and jitter, bounded attempts, and a dead-letter/review path. Do not retry invalid credentials or malformed payloads forever. Backoff, bulkheads, per-tenant budgets, and queue fairness prevent a noisy Organization from starving others.

Ordering is scoped deliberately: per conversation, per channel connection, or per Zapo session as required. Strict global ordering creates head-of-line blocking and is not a default.

## Realtime and tracing

SSE is the v0.1 transport because the browser primarily receives invalidation events and the API already owns authorization. The client invalidates/refetches through the query cache; SSE is not the source of truth. WebSockets are deferred until bidirectional low-latency behavior justifies the lifecycle and scaling cost.

Correlation and trace context cross queue payloads and provider calls. Async jobs use span links when a single parent is not semantically correct. Traces are short lifecycle traces, not days-long session traces.
