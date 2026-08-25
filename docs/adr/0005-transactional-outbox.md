# ADR-0005: Transactional outbox and at-least-once delivery

Status: ACCEPTED

## Decision

Commit business state and outbox intent in one transaction. Relay with leases/SKIP LOCKED, deliver through at-least-once queues, and make consumers idempotent.

## Consequences

Exactly-once external side effects are not promised. Ambiguous outcomes, dedupe keys, retry classes, and reconciliation are explicit product behavior.
