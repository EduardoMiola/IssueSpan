# Execution backlog

Jira is the delivery system of record; this file is the durable architecture-facing index. Planned walking-skeleton order is: IS-13 repository foundation → IS-16 Docker development environment → IS-14 database/tenancy → IS-15 auth/TenantContext → IS-17 conversation domain → IS-18 API contract → IS-19 outbox/worker → IS-21 React shell/inbox → IS-22 SSE → IS-20 golden path/complete CI. Later issues cover GitHub, impact, Zapo, Email, Linear/Jira, diagnostics, security, and production operations.

The first 20 PR plan is maintained in Jira IS-13 and its linked issues. Branches use `feat/IS-123-short-name`; Codex-generated work may use `codex/IS-123-short-name`. Work is trunk-based: short-lived branch, focused PR, squash merge, no direct main commits.

Definition of Done: tests; documentation; security/tenant impact; observability; migration safety; provider failure semantics; PR link; Jira status update; and no unrelated worktree changes.
