# Runbook: channel reconnect storm

Status: **PLANNED; validate against measured worker limits.**

## Trigger and impact

Use when many `ChannelConnection` records transition to `RECONNECTING`, inbound coverage falls, outbound queue age rises, or worker event-loop delay/memory grows. Impact may include delayed messages, duplicate connection attempts, provider throttling, or loss of customer context.

## Safe diagnosis

Check the connection projection, worker/partition/generation, reconnect rate, provider error class, queue age, RSS/heap, event-loop delay, sockets, and recent release. Correlate by trace and incident fingerprint; do not use session IDs as global metric labels. Confirm whether ownership is unique before starting any repair.

## Mitigation

Pause nonessential history sync and outbound retries. Enforce the reconnect semaphore and maximum connections per second. Stop workers that have lost lease renewal; do not let a stale worker continue “to be helpful.” If provider capping is visible, apply backoff and preserve durable intent in PostgreSQL.

## Recovery

Drain or restart one worker at a time. Move partitions gradually, verify generation fencing, and reconnect in batches with jitter. Confirm credentials are reused without QR. Reconcile ambiguous outbound Messages by stable provider ID and mark unresolved outcomes explicitly.

## Escalation and prevention

Escalate provider-wide failures separately from a bad release or split brain. Preserve the release, worker version, partition, generation, and safe error code. Add a regression or soak scenario for the observed failure; never “fix” a storm by removing ownership checks.
