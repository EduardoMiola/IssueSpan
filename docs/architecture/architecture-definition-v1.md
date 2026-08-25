# IssueSpan Architecture Definition v1

**Status:** Frozen baseline  
**Owner:** Eduardo Miola  
**Scope:** Repository and product architecture

## 1. Core decisions

IssueSpan is a modular monolith with explicit bounded contexts and Ports & Adapters at integration boundaries. It is deployed as separate runtime processes where lifecycle or scaling characteristics differ:

```text
web             React SPA
api             synchronous HTTP and SSE boundary
worker          transactional outbox and asynchronous jobs
channel-worker  long-lived Zapo/WhatsApp connection ownership
```

The initial implementation remains one repository and one domain model. Process separation is operational; it does not turn the internal modules into distributed services.

## 2. Technology baseline

| Concern | Decision |
|---|---|
| Frontend | React 19.2, Vite, React Router, TanStack Query |
| Backend | Node.js 24, TypeScript, Fastify 5 |
| Database | PostgreSQL 18, Prisma 7 |
| Queue/cache | BullMQ with Redis-compatible Valkey |
| Files | S3-compatible object storage |
| Authentication | Server-side sessions, secure HttpOnly cookies |
| Authorization | Membership-scoped capability RBAC |
| Realtime | Server-Sent Events |
| Testing | Vitest, Testcontainers, Zapo fake server, Playwright |
| Observability | OpenTelemetry, Pino, Collector, SigNoz reference stack |
| Deployment | OCI containers on AWS ECS; OpenTofu; GitHub Actions |

## 3. Bounded contexts

```text
Identity & Organizations
Customers & Contacts
Conversations & Messages
Messaging Channels
Escalations & Customer Impact
Engineering Integrations
Audit & Operations
```

Modules communicate through application commands, domain events, and explicit ports. A module must not reach into another module's persistence internals through arbitrary imports or direct queries.

## 4. Tenant isolation

The database uses shared tables with `organization_id`, tenant-aware foreign keys, and PostgreSQL RLS as defense in depth. Tenant context comes from the authenticated membership, never from a client-provided organization ID alone.

The same rule applies to cache keys, object-storage paths, queue payloads, repository methods, audit records, and tests. Cross-tenant negative tests are mandatory for protected resources.

## 5. Reliability model

Business state and the intention to publish an event are committed in one transaction through a transactional outbox. Relays and consumers are at-least-once. Every consumer and externally side-effecting command must define an idempotency key and a retry policy.

The system does not claim exactly-once delivery across an external provider boundary unless that provider supplies an idempotent operation contract.

## 6. Provider boundaries

```text
MessagingChannel
  └── ZapoWhatsAppAdapter

EmailChannel
  └── EmailProvider
        └── PostmarkAdapter (v1 first provider)

EngineeringIssueProvider
  ├── GitHubAdapter
  ├── JiraAdapter
  └── LinearAdapter
```

IssueSpan owns `EngineeringIssue`, `Escalation`, Conversation, CustomerAccount, and customer-impact relationships. External systems own provider-native issue identifiers, statuses, labels, and comments; IssueSpan stores projections of those facts.
