# Channel-worker architecture

**Status:** Frozen operational boundary; v0.1 target.

HTTP is short-lived and request-driven. Zapo is stateful, long-lived, reconnecting, and ownership-sensitive. Separation provides failure isolation, independent scaling, and a single-writer model.

~~~text
ChannelConnection → owner worker → lease + generation/fencing token → Zapo session
~~~

Only one worker owns a session generation. Lease expiry permits takeover with an increasing generation; stale operations are fenced. Evaluate consistent or rendezvous hashing: modulo worker-count remaps too many stateful sessions and can cause reconnect storms.

Inbound: provider event → validation/normalization → stable ID/dedup → tenant resolution → application command → message plus inbox/outbox transaction → read model/SSE.

Outbound: API message QUEUED plus outbox → relay/BullMQ → lease/idempotency check → provider send → receipt or recoverable unknown → status, outbox, audit.

Use bounded concurrency, tenant quotas, retry classification, jitter, dead letters, circuit breaking, and graceful shutdown. Exactly-once is not claimed without provider idempotency.
