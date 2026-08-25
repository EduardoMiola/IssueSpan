# Runbook: restore exercise

Status: **PLANNED release evidence.**

## Hypothesis

“A PostgreSQL restore plus object-storage recovery can bring IssueSpan back with tenant isolation, durable outbox intent, and attachment authorization intact.” Define target RTO/RPO before testing; this document does not claim values.

## Procedure

Restore to an isolated account/network with no provider side effects. Run migrations only through the migrator role, start the application with read-only probes, and verify Organization counts, membership permissions, RLS policies, composite FKs, Message/Outbox consistency, object metadata, and signed-download tenant checks. Reconstruct queue work from durable PostgreSQL state rather than treating Valkey as backup truth.

## Exit criteria

Exercise representative tenant reads, login/session revocation, Conversation history, EngineeringIssue impact, attachment scan state, audit metadata, and a no-network dry-run of pending provider actions. Record time, data point, release/digest, restore source, gaps, and follow-up owners. A successful snapshot download is not a successful recovery.
