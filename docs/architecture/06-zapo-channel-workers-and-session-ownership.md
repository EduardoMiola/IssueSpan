# Zapo channel workers and session ownership

Status: **CURRENT design; planned implementation.**

Zapo is the first WhatsApp channel because it exercises the hardest product and reliability boundary: customer conversation, provider state, credentials, reconnects, long-lived sockets, and external delivery acknowledgement. The integration remains behind `MessagingChannel`; the domain does not import Zapo SDK types.

## Runtime ownership

`WaClient`, coordinators, caches, and session-scoped protocol state are keyed by `sessionId`. Durable protocol state and encrypted references belong in storage; archives are disabled unless a deliberate retention decision says otherwise. A process-local L1 cache is valid only under a single-writer assumption. Disconnect means the transport is unavailable; logout means credentials/session state was intentionally invalidated. They are different transitions.

Secrets are encrypted or delegated to a secret store, redacted from logs, and never placed in browser payloads. The v0.1 plan has one channel-worker runtime, but the ownership model is explicit before adding replicas.

## Stable ownership

Modulo hashing is a poor long-term assignment strategy: adding a worker remaps most sessions and creates reconnect storms. A logical partition model gives each `partition_id` a stable lease and lets workers claim partitions. Illustrative—not normative—lease intervals might be tens of seconds; production values require failure and reconnect measurements.

```text
worker_registry(worker_id, generation, heartbeat_at, capacity, state)
partition_lease(partition_id, worker_id, generation, lease_until, version)
zapo_session(session_id, partition_id, owner_generation, state, secret_ref)
```

Heartbeat says the process is alive. A lease says this generation may act for a partition. Fencing tokens/generations reject stale writes in IssueSpan-owned state. They cannot perfectly fence a WhatsApp side effect already sent to the provider; when ownership is uncertain, pause outbound work and reconcile.

## Split-brain example

Worker A pauses during a network partition while Worker B acquires the lease. A resumes with stale state and tries to send. Database-side generation checks reject local state mutation, but the provider may have received the request before the check or may not support idempotency. This residual risk is why correctness beats availability and why reconciliation/incident visibility are required.

## Session actor and handoff

Treat each session as an actor-like `SessionRuntime` supervised by a worker `Supervisor`. Commands for one session are serialized through that runtime. A graceful handoff drains new work, persists the generation, closes the old socket, transfers the lease, starts the new runtime, and verifies state before resuming. Reconnect throttling, jitter, circuit breaking, and storm budgets prevent all sessions from reconnecting together.

Capacity is based on weighted units, not only worker count: memory/session, message rate, media, file descriptors, event-loop lag, GC pauses, and reconnect cost matter. An internal dispatcher/RPC path may route outbound work to the owning channel worker when the API/general worker cannot reach it directly.

Later, cells can group partitions by region or operational blast radius. Multi-million sessions require measured capacity, durable ownership, staged handoffs, and provider limits; they do not follow automatically from adding replicas.
