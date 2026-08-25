# IssueSpan Engineering Instructions

IssueSpan is an open-source support platform where customer conversations and engineering work are connected. The project is owned and maintained by Eduardo Miola (`EduardoMiola`).

## Frozen architecture baseline

- Use a modular monolith with explicit bounded-context modules.
- Keep ports and adapters at external boundaries.
- Runtime processes are `web`, `api`, `worker`, and `channel-worker`.
- Use React 19.2/Vite on the frontend and Node.js 24/TypeScript/Fastify 5 on the backend.
- Use PostgreSQL 18 with Prisma 7, BullMQ with Valkey, and S3-compatible object storage.
- Every tenant-owned record and asynchronous job must carry `organization_id` context.
- Use server-side sessions in secure HttpOnly cookies and membership-scoped capability authorization.
- Use transactional outbox, at-least-once delivery, idempotent consumers, and SSE for realtime updates.
- Keep Zapo behind a `MessagingChannel` port; do not leak provider types into the domain.
- v0.1 targets WhatsApp/Zapo. v1.0 adds Email through an `EmailProvider` port, with Postmark first.
- IssueSpan owns customer impact, conversations, escalations, and account relationships. GitHub, Jira, and Linear own provider-native engineering facts.

## Delivery rules

- Work from a Jira issue and reference its key in branch names, commits, and pull requests.
- Use feature branches and pull requests; do not commit directly to `main`.
- Add tests with behavior changes. Prefer focused validation before broad suites.
- Do not add migrations, infrastructure, credentials, or provider coupling without an explicit decision record.
- Preserve unrelated working-tree changes.

The source-of-truth planning documents are under [`docs/`](docs/README.md).
