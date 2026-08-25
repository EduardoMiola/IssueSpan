# Messaging, events, and reliability

Status: **CURRENT baseline; planned implementation.**

IssueSpan is distributed at its boundaries: PostgreSQL, Valkey, Zapo/WhatsApp, engineering providers, email providers, and browser connections fail independently. This document makes the failure semantics explicit before implementation.

## Vocabulary and invariants

- A **command** asks IssueSpan to do something and may be rejected by policy.
- An **event** is a fact that already happened; consumers must not reinterpret it as a request.
- A **domain event** stays inside a bounded context.
- An **integration event** is versioned and safe to cross a process or provider boundary.
- A **job** is durable infrastructure work that may run more than once.

The core reliability mnemonic is:

```text
Retry       = I will try again.
Idempotency = trying again will not create another logical side effect.
Outbox      = a committed DB transaction will not lose its intent to notify.
```

At-least-once delivery is the default. Exactly-once external side effects are not claimed. A provider may accept a message and the process may crash before recording the acknowledgement; that is an ambiguous outcome.

## Event envelope

Every integration event has a stable envelope:

```json
{
  "id": "uuidv7",
  "type": "conversation.message.created",
  "version": 1,
  "occurredAt": "2026-08-25T12:00:00Z",
  "organizationId": "org_...",
  "aggregate": { "type": "Message", "id": "msg_..." },
  "correlationId": "trace-workflow-id",
  "causationId": "direct-parent-event-id",
  "payload": {}
}
```

`id` supports dedupe, tracing, replay, and audit. `correlationId` identifies the complete workflow; `causationId` identifies the direct cause. Payloads contain IDs and safe metadata, not provider secrets or unnecessary transcript content. Every event type has an owner and compatibility policy.

## Inbound flow

```text
WhatsApp/Zapo event
  → typed ZapoInboundAdapter
  → normalized InboundMessage
  → verify ChannelConnection and Organization
  → database dedupe constraint
  → Contact / Conversation / Message transaction
  → Outbox event
  → commit
  → SSE invalidation and downstream jobs
```

The normalized shape contains `channelConnectionId`, `providerMessageId`, `remoteIdentity`, `providerTimestamp`, `direction`, and normalized content. Zapo types do not enter Conversation domain code. A duplicate provider event is a successful no-op with a traceable result.

Inbound persistence is ordered as dedupe → resolve/create Contact → resolve/open Conversation → insert Message → reopen/update activity → append outbox → commit. No provider or network call happens inside this transaction.

`message_unavailable` is a real protocol fact. Insert a Message placeholder with `contentState=UNAVAILABLE`; later recovery with the same provider ID upgrades it to `AVAILABLE`. History sync uses this same pipeline, so replay does not create a second conversation history.

## Outbound flow and states

```text
browser POST /messages
  → authorize and validate
  → DB transaction: Message(QUEUED) + outbox
  → 201 Created
  → relay claims outbox row
  → BullMQ job (at-least-once)
  → dispatcher / Channel Worker
  → provider adapter
  → provider acknowledgement or failure
  → durable Message transition + receipt events
```

The API returns the real queued Message, not a fake optimistic success and not merely `202` because delivery is asynchronous. For Zapo, `SENT` means WhatsApp server acknowledgement. `DELIVERED` and `READ` come from receipts. Email has different semantics: provider acceptance is `SENT`, while `DELIVERED` means the receiving mail system accepted the message, not that a human read it.

Candidate state transitions are `QUEUED → SENDING → SENT → DELIVERED → READ`, with `FAILED` and `DELIVERY_UNKNOWN` where appropriate. A stable provider message ID is generated before the first attempt and reused on retry. This reduces duplicate risk but does not create exactly-once behavior.

## Transactional outbox

The outbox row contains `id`, `organization_id`, `event_type`, `version`, aggregate identity, payload, correlation/causation IDs, `occurred_at`, availability, status, attempt count, lease expiry, claimant, publish time, and last error.

The relay claims with `FOR UPDATE SKIP LOCKED`, marks the row leased in a short transaction, commits, publishes outside the transaction, and records published state in a second transaction. A crash after publish and before marking published produces a duplicate. Consumers must be idempotent. BullMQ `jobId=event.id` is useful additional dedupe, never the sole guarantee.

## Queues, retries, and failure classes

Queues are separated by workload: `channel-send`, `webhook`, `notification`, `integration`, and `maintenance`. This is a bulkhead: a provider outage must not prevent security or database maintenance from progressing.

| Class | Examples | Action |
| --- | --- | --- |
| Retryable | timeout, network reset, 503, transient Redis failure | exponential backoff, jitter, bounded attempts |
| Terminal | invalid recipient, malformed payload, revoked channel | persist failure, alert or require repair |
| Deferred | provider cap, temporary rate limit | scheduled retry respecting provider window |
| Ambiguous | provider may have accepted before crash | reconcile, stable ID, show uncertainty |

Nested retry budgets must be coordinated: Zapo attempts multiplied by BullMQ attempts must not create a retry storm. After bounded attempts, retain a failure/dead-letter record with a safe replay command. Replay is an operational action, not an invisible infinite loop.

Ordering is scoped per Conversation, ChannelConnection, or ZapoSession where required. Global ordering creates head-of-line blocking and is not a default. Per-conversation sequencing may still trade throughput for understandable customer-visible history.

Tenant fairness requires per-Organization rate limits, concurrency budgets, queue age monitoring, and a scheduler that avoids a large tenant consuming every worker slot.

## Realtime

For v0.1, REST is the command and query surface; SSE is primarily a server-to-browser invalidation channel:

```text
DB transaction → outbox → realtime publisher → Valkey Pub/Sub
  → API SSE connection → query invalidation/refetch
```

Valkey Pub/Sub is ephemeral by design. Reconnect triggers a refetch from PostgreSQL, so a dropped signal cannot lose canonical state. SSE events are small identity/signal messages, not full mutable entities. One workspace-scoped EventSource is preferred; filter server-side by Organization. WebSockets are deferred for presence, typing, or collaborative behavior that needs bidirectional lifecycle.

## Tracing and shutdown

Propagate trace context through HTTP, outbox payloads, BullMQ metadata, and provider calls. Use producer/consumer spans or span links rather than one giant synchronous trace. Provider receipts begin a new trace linked by provider message ID to the original Message.

Graceful shutdown stops accepting new work, drains bounded jobs, stops claiming outbox rows, closes SSE connections with reconnect-friendly semantics, and hands channel ownership back safely. Poison jobs have size and attempt bounds. Secrets never appear in queue payloads.

## Why not Kafka, exactly-once, or one queue per session?

Kafka is deferred until measured throughput, replay, keyed ordering, fanout, or economics justify its operational cost. PostgreSQL outbox plus BullMQ is easier to operate for the first walking skeleton. Exactly-once cannot be promised when the external provider does not participate in the transaction. A queue per session creates unbounded infrastructure objects; logical partitions and a dispatcher provide ordering and ownership without that cost.

## Testing and operations

Required tests include atomic Message+Outbox commit, duplicate provider delivery under concurrency, relay crash after publish, idempotent consumer replay, nested retry bounds, out-of-order receipts, tenant fairness, SSE reconnect/refetch, and provider-accepted-then-process-crashed ambiguity.

Operators need queue age and oldest-job metrics, outbox pending/leased/published counts, attempts and dead letters, provider error class, per-tenant backlog, send latency split into API durable/queue/ACK/receipt, and trace IDs. A queue depth alone is not a health model.

The interview explanation is: “The database commits customer-visible intent first, the outbox makes that intent durable, the queue gives at-least-once execution, and idempotent consumers make retries safe. External delivery remains explicitly ambiguous when the provider and process fail between one another.”
