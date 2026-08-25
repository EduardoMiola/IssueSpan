# Runbook: bad deployment rollback

Status: **PLANNED.**

## Safety first

Identify release commit and image digest, affected process (`api`, `worker`, `channel-worker`, or web), migration state, and whether any external side effects are ambiguous. Do not roll back application code across an incompatible destructive migration.

## Procedure

Stop progression, preserve traces and safe errors, and pin the last known-good digest. Roll API and general workers using N/N-1-compatible queue contracts. Roll Channel Worker by gradual partition handoff; never run two owners for the same ZapoSession. Revert frontend asset pointer if needed, then smoke-test tenant isolation, send queueing, inbound persistence, and readiness.

## Follow-up

If the migration is compatible, forward-fix on the next release. If not, use the documented expand/contract recovery path. Record customer impact, ambiguous Messages, release fingerprints, and a regression test before reopening deployment.
