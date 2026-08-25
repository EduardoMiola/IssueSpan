# API and frontend architecture

**Status:** Frozen contract direction; routes are implementation backlog.

Fastify is the synchronous boundary for auth, authorization, validation, commands, queries, webhooks, health, and SSE. Use versioned JSON, Zod, error envelopes, request IDs, and pagination tokens. Suggested groups: `/v1/auth`, `/organizations`, `/members`, `/customers`, `/conversations`, `/messages`, `/escalations`, `/integrations`, `/audit`, `/events`, `/webhooks`, plus `/health/live` and `/health/ready`.

External work returns accepted/queued with an operation or message ID; API does not wait on a provider. Every protected route derives organization from server session and membership capability. Frontend visibility is not the security boundary.

SSE events include event ID, organization, type, resource, version/timestamp, and correlation ID. Clients reconnect with `Last-Event-ID`. React/Vite uses workspace context, TanStack Query, and typed forms. Features are auth, workspace, inbox, customers, escalations, integrations, and audit.

401 clears session; 403 denies without disclosure; 404 is resource-safe; 409 exposes version/idempotency conflict; 422 validates; 429 preserves input; network/5xx never blindly duplicates sends. Contract changes are additive where possible and tested.
