# Runbook: PostgreSQL exhaustion

Status: **PLANNED.**

## Trigger

Use when connection wait rises, pool slots are exhausted, transaction age grows, locks/deadlocks increase, or API latency/error rates breach the provisional target. Protect the database before scaling every caller.

## Diagnosis

Compare global connection usage across API replicas, general worker, Channel Worker, migrations, and admin sessions. Inspect active/idle-in-transaction sessions, lock waits, slow plans, I/O, CPU, memory, and RDS failover state. Identify tenant skew and whether a deploy changed query shape.

## Mitigation and recovery

Pause maintenance and nonessential queue work; cap concurrency; shed expensive search or history requests; preserve authentication and inbound persistence. Do not kill unknown sessions indiscriminately. Resolve the owning release or query, verify tenant predicates/RLS context, and restore traffic gradually.

## Prevention

Keep a fleet-wide connection budget, test `EXPLAIN (ANALYZE, BUFFERS)`, use keyset pagination, and add indexes from measured query shape. Read replicas and pooling are later decisions, not emergency substitutes for a missing predicate.
