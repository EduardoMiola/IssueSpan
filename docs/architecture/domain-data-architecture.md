# Domain and data architecture

**Status:** Frozen baseline; schema details require implementation ADRs.

Identity owns Organization, Membership, User, Session, and capabilities. Customers owns CustomerAccount and Contact. Conversations owns Conversation, Message, participant, assignment, status, tags, and notes. Channels owns connections and delivery state. Engineering Impact owns Escalation, impact, evidence, and provider-link projections. Audit owns append-only actor/action/resource history.

Shared PostgreSQL tables use `organization_id`. Tenant-aware relationships and uniqueness include the organization where practical. Repositories require tenant context; PostgreSQL RLS is defense in depth. Propagate context to database, cache keys, object paths, queue payloads, logs, traces, metrics, audit, and fixtures. A client organization ID is never authorization.

~~~text
Organization → Membership → User
Organization → CustomerAccount → Contact
Organization → Conversation → Message / Assignment / Escalation
Organization → ChannelConnection / AuditEvent / OutboxEvent
~~~

Messages are channel-neutral; WhatsApp and future email metadata are separate. Business mutation and external intention share a transactional outbox transaction. Webhook inbox records and idempotency keys make retries safe. Search begins with PostgreSQL indexes/read models. Read models require replay/rebuild procedures.

Define retention, export, deletion, attachment controls, and audit policy before storing content.
