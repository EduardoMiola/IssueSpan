# Contribution instructions

## Jira and delivery workflow

Jira is IssueSpan's delivery record; GitHub is its code, review, and release record; ADRs and architecture documents are its technical-decision record.

Before significant work, inspect GitHub and Jira, reconcile stale Jira status against merged or open PRs, identify an unblocked issue, and do not implement untracked work. During implementation, move the issue to **IN PROGRESS**, record branch/PR information, and move it to **IN REVIEW** when the PR opens. Search Jira before creating a follow-up; create one when an out-of-scope defect, required security/architecture/test work, conscious debt, or deferred milestone work has no existing issue. Link newly discovered blockers and dependencies.

Do not silently expand a ticket, duplicate work items, treat Jira status as evidence instead of checking GitHub, mark an issue Done before its PR is merged and acceptance criteria are met, or mark an Epic Done while child work remains. Keep Jira, GitHub, and repository documentation synchronized.

- Every change starts from a Jira issue and links the PR back to it.
- Do not commit directly to `main`; use a short-lived `feat/IS-123-...` or `codex/IS-...` branch and squash merge.
- Preserve unrelated worktree changes and existing history.
- Keep bounded-context ownership explicit. No direct cross-module Prisma queries or provider SDK imports in domain/application code.
- TenantContext is mandatory for tenant-owned reads and writes; fail closed when absent.
- Add domain, integration, tenant-negative, or contract tests appropriate to the change.
- Add/update an ADR for boundary, invariant, security, external-contract, migration, deployment, or licensing decisions.
- Never log secrets, tokens, credentials, raw message bodies, or customer data by default; redact telemetry and fixtures.
- Documentation must label CURRENT, PLANNED, DEFERRED, and PROPOSED accurately and must not claim future components are implemented.
