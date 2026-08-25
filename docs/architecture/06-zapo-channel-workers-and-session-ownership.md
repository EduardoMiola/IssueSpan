# Zapo channel workers and session ownership

Status: **CURRENT design; planned implementation.**

Zapo is the first WhatsApp channel because it exercises the hardest boundary: customer conversations, credentials, long-lived sockets, reconnects, provider acknowledgements, and stateful protocol caches. Product code depends on a `MessagingChannel` port, never on Zapo SDK types.

## Technical facts that shape the design

`zapo-js` is a TypeScript WhatsApp Web protocol implementation. A thin IssueSpan `WaClient`, coordinators, and typed adapters should scope every query and event by `sessionId`. Zapo supports durable auth, Signal, pre-key, session, identity, sender-key, app-state, and privacy-token stores backed by SQLite, PostgreSQL, MySQL, Redis, or MongoDB. IssueSpan owns product Messages and Conversations, so Zapo archives for messages, threads, and contacts should be configured as `none` initially.

Zapo's process-local `cacheLayer` can accelerate hot protocol stores, but it has no cross-process invalidation. It is safe only while one process is the writer for a session. Credentials persist across restart; after pairing, `connect()` should reuse them without a QR. `disconnect()` closes transport and preserves credentials; `logout()` intentionally unlinks the companion and normally clears state. These are separate product and operational transitions.

Auth credentials contain secret keys and can impersonate the device if compromised. Encrypt durable state where appropriate, restrict access to the channel worker, and never return it to a tenant browser or normal API response.

## Ownership invariant

> At most one active execution owner may operate a Zapo session at a time.

This protects mutable Signal state, ratchets, socket callbacks, and the process-local cache. Durable protocol state may live in PostgreSQL, while the live `WaClient`, socket, and L1 cache live in worker memory. New workers can resume only after ownership is unambiguous.

V0 uses one Channel Worker for all sessions. Distributed lease machinery should not be added before one-worker correctness is demonstrated with the fake server and restart tests.

## Runtime shape

```text
ChannelWorkerRuntime
  ├─ WorkerRegistration / heartbeat
  ├─ LeaseManager
  ├─ CapacityTracker
  ├─ SessionSupervisor
  │    └─ SessionRuntime(sessionId, ChannelConnection, generation)
  │         ├─ state machine
  │         ├─ command queue
  │         ├─ WaClient
  │         └─ session metrics
  ├─ command server / dispatcher client
  └─ telemetry
```

Only `SessionRuntime` touches `WaClient`. Commands for one session are serialized like an actor. The state machine distinguishes `STOPPED`, `CONNECTING`, `CONNECTED`, `RECONNECTING`, `ERROR`, and `LOGGED_OUT`; disconnect and logout are explicit commands.

## Fleet assignment

`hash(sessionId) % workerCount` remaps most sessions when worker count changes and can create a reconnect storm. The planned fleet design uses many logical partitions:

```text
ChannelConnection stable identity
  → persisted logical partition P0..P1023 (illustrative)
  → leased worker
  → SessionRuntime
```

The exact partition count and weights require benchmarks. The key is a stable `partition_id`, not a fixed formula that changes with fleet size. Use `ChannelConnectionId` as the distribution key rather than OrganizationId so one tenant with hundreds of channels can spread across workers.

Illustrative control-plane tables:

```text
partition_lease(partition_id, owner_worker_id, generation,
                lease_expires_at, last_renewed_at, desired_owner_id)
worker_registry(worker_id, hostname, process_id, version, status,
                capacity_units, last_heartbeat_at, started_at)
channel_connection(id, organization_id, zapo_session_id,
                   partition_id, desired_state, credential_ref)
```

Heartbeat is process health; a lease is ownership. They are deliberately different signals. Lease timing such as 15 seconds with renewal every 5 seconds is a lesson example only, not a production claim. Use PostgreSQL server time, not worker clocks.

Acquire increments `generation`. Renew uses `WHERE owner_worker_id = ? AND generation = ? AND lease_expires_at > server_now`; zero affected rows means ownership is lost and the runtime must stop. The generation is a fencing token for IssueSpan-owned writes.

## Split brain and residual provider risk

```text
Worker A owns generation N and pauses
  → lease expires
  → Worker B acquires generation N+1
  → A resumes with stale socket/cache
  → database fencing rejects stale IssueSpan writes
  → provider may still accept an external send
```

Leases alone are insufficient. Internal writes and RPCs must validate generation. WhatsApp cannot validate IssueSpan's generation, so perfect fencing of an already-issued external send is impossible. Mitigations are one owner, short validation windows, immediate disconnect on lease loss, stable external message IDs, correct routing, bounded handoff, and reconciliation. When ownership is uncertain, stop outbound work; correctness wins over availability.

## Lease granularity and scheduler

Lease partitions, not sessions. A hypothetical 100,000 sessions renewing every five seconds creates about 20,000 renewal writes per second; 1,024 partitions create about 205. These values are illustrative, but the scaling relationship explains the choice. Too few partitions create hot spots, so capacity weights and optional overrides may be needed.

The control plane owns membership, capacity, desired placement, draining, and rebalance. The data plane owns sockets and message events. A short control-plane outage may let existing owners continue until their safety deadline; it must not permit work after ownership expires.

An explicit small scheduler is preferred initially for predictable draining. Rendezvous hashing or a race-to-acquire can be evaluated later. The scheduler is not a reason to introduce Kubernetes, etcd, or ZooKeeper in v0.1.

## Handoff and reconnect storm control

```text
worker ACTIVE → DRAINING
  → stop acquiring partitions
  → stop new session work
  → finish bounded in-flight commands
  → disconnect while preserving credentials
  → release lease
  → target acquires newer generation
  → reconnect sessions gradually
```

An abrupt crash follows heartbeat/lease expiry, new acquisition, and gradual reconnect. A supervisor isolates one failing session from the fleet. Reconnect uses a semaphore, maximum concurrent connections, maximum connections per second, exponential backoff, and jitter. Never use `Promise.all(3000)` for a reconnect storm.

`connect()` should use persisted credentials; pairing is not repeated after every process replacement. `message` events use `key.id` and `fromMe`. The outgoing coordinator resolves on WhatsApp server ACK, while receipts report delivered/read/played/inactive later. A supplied message ID must be stable across retries. The fake server supports E2E scenarios for these transitions.

## Capacity model

No sessions-per-worker claim is valid before measurement. Capacity depends on memory, Signal cache, groups, media, message rate, reconnect rate, file descriptors, network, CPU, and Node garbage collection. Later, capacity units may combine base session cost with message, media, cache, and reconnect weights.

Scale on sessions plus memory/RSS, event-loop delay, message and reconnect rate, partition weight, and connection failures—not CPU alone. Reconnect capacity may be tighter than idle capacity. CPU-heavy history work must move off the event loop if measured.

## Outbound routing and security

The durable BullMQ command is the source of intent. A dispatcher resolves the current owner and calls an abstract `ChannelWorkerCommandClient`; internal HTTP is sufficient first, with gRPC only after measured need. An ambiguous RPC after provider success still requires stable IDs and reconciliation.

`ChannelConnection` is authoritative for `organization_id`, `zapo_session_id`, and `partition_id`. Never infer Organization from a session ID. Only the channel worker needs Zapo secrets. Tenant APIs can request connect/disconnect/reconnect only after capability checks; credentials and QR material are protected and audited.

## Testing, observability, and evolution

Tests cover one acquisition, competing acquisition, expiry, generation fencing, lost renewal shutdown, A-pauses/B-takes-over split brain, restart without QR, message ACK/receipt, `message_unavailable` recovery, bounded reconnect concurrency, and planned handoff. Soak tests record RSS, heap, external memory, event-loop delay, sockets, reconnects, and file descriptors.

Operations expose connected-channel percentage, failure-to-reconnect time, send availability, session state, worker, partition, generation, reconnect count, and provider capping state. Do not turn session or message IDs into global metric labels; use logs/traces and a diagnostic projection.

The evolution is one worker → fleet with partition leases → scheduler/dispatcher/capacity weights → channel cells. Cells and multi-region routing are deferred until measured session count, blast radius, or regional latency requires them.

Interview mental model: “A Zapo session is a stateful actor with one writer. Durable credentials let it restart, leases and generations coordinate ownership, and a supervisor makes failure local. External delivery still has an ambiguity window, so the system never promises exactly once.”
