# Runbook index

Status: **SKELETON; each runbook becomes a release artifact before production.**

- Channel reconnect outage: identify affected connections, lease owners, provider errors, storm controls, drain/handoff, and customer communication.
- Outbox backlog: inspect age/volume, relay leases, terminal errors, tenant fairness, and safe replay.
- Queue failure: inspect BullMQ/Valkey health, retry class, dead letters, and worker rollout.
- Postgres connection exhaustion: identify pool budgets, blocked queries, replicas, and emergency load shedding.
- Provider rate limit/token revoked: isolate the provider/tenant, rotate or reauthorize safely, and reconcile.
- Bad deploy rollback: pin prior digest, protect migrations, verify health, and record forward-fix needs.
- Restore exercise: restore to an isolated target, verify RLS/tenant counts and application reads, and document RTO/RPO evidence.
