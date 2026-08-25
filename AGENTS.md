# Contribution instructions

- Every change starts from a Jira issue and links the PR back to it.
- Do not commit directly to `main`; use a short-lived `feat/IS-123-...` or `codex/IS-...` branch and squash merge.
- Preserve unrelated worktree changes and existing history.
- Keep bounded-context ownership explicit. No direct cross-module Prisma queries or provider SDK imports in domain/application code.
- TenantContext is mandatory for tenant-owned reads and writes; fail closed when absent.
- Add domain, integration, tenant-negative, or contract tests appropriate to the change.
- Add/update an ADR for boundary, invariant, security, external-contract, migration, deployment, or licensing decisions.
- Never log secrets, tokens, credentials, raw message bodies, or customer data by default; redact telemetry and fixtures.
- Documentation must label CURRENT, PLANNED, DEFERRED, and PROPOSED accurately and must not claim future components are implemented.
