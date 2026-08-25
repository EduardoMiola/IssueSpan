# Runbook: outbox and queue backlog

Status: **PLANNED.**

## Diagnose

Measure oldest outbox age, pending/leased/published counts, lease expiry, relay error classes, BullMQ queue age, attempts, dead letters, worker throughput, and per-Organization fairness. A large depth with young jobs differs from a small queue with one ancient poisoned job.

## Mitigate safely

Do not delete rows or blindly requeue everything. Stop a failing consumer if it is creating duplicates; preserve the event and trace. Repair transient Valkey/provider capacity first. For terminal failures, require a reviewed replay or user repair. Keep queue payloads to identifiers and safe metadata.

## Recovery

Restart or scale the relay/worker only after identifying the failure class. Replay a bounded dead-letter sample, verify idempotency and database effects, then increase gradually. Confirm tenant fairness and that outbox events remain durable if Valkey is unavailable.

## Evidence

Record event type/version, Organization, attempt count, last error code, worker release, and trace ID. Never record secrets or transcript content. Add a failure-injection test for the exact crash window when a relay published but failed to mark the row.
