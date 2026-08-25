# Architecture diagrams

Status: **CURRENT explanatory diagrams; implementation planned.**

## C4 context

```mermaid
flowchart LR
  Agent[Support or engineering user]
  Customer[Customer contact]
  IssueSpan[IssueSpan platform]
  Zapo[Zapo / WhatsApp]
  Email[Postmark Email]
  GitHub[GitHub / Linear / Jira]
  Agent --> IssueSpan
  Customer --> Zapo
  Customer --> Email
  Zapo <--> IssueSpan
  Email <--> IssueSpan
  IssueSpan <--> GitHub
```

## C4 containers

```mermaid
flowchart TB
  Web[apps/web React SPA] --> API[apps/api Fastify]
  API --> PG[(PostgreSQL source of truth)]
  API --> Redis[(Valkey cache queue realtime)]
  API --> Outbox[Transactional outbox]
  Outbox --> Worker[apps/worker finite jobs]
  Worker --> Providers[Email and engineering providers]
  Worker --> Dispatch[Channel dispatcher]
  Dispatch --> Channel[apps/channel-worker long-lived sessions]
  Channel --> Zapo[Zapo / WhatsApp]
  API --> SSE[SSE invalidation]
```

## Outbound Message

```mermaid
sequenceDiagram
  participant B as Browser
  participant A as API
  participant D as PostgreSQL
  participant R as Outbox relay
  participant Q as BullMQ
  participant C as Channel Worker
  participant Z as Zapo
  B->>A: POST Message
  A->>D: Message QUEUED + Outbox in one transaction
  A-->>B: 201 Created
  R->>D: claim with lease
  R->>Q: publish event
  Q->>C: at-least-once job
  C->>Z: send stable provider ID
  Z-->>C: server ACK
  C->>D: record SENT / reconcile ambiguity
```

## Inbound Message

```mermaid
sequenceDiagram
  participant Z as Zapo
  participant A as Adapter
  participant D as PostgreSQL
  participant S as SSE
  Z->>A: typed inbound event
  A->>A: verify connection, normalize, dedupe
  A->>D: Contact + Conversation + Message + Outbox
  D-->>A: commit
  A->>S: publish small identity signal
  S-->>S: browser invalidates and refetches REST truth
```

## Channel ownership handoff

```mermaid
sequenceDiagram
  participant A as Worker A
  participant P as PostgreSQL lease
  participant B as Worker B
  A->>P: renew generation N
  A->>P: enter DRAINING, release partition
  B->>P: acquire generation N+1
  B->>B: start SessionRuntime gradually
  P-->>A: renewal rejected if stale
  A->>A: stop socket and outbound work
```

## Cloud deployment

```mermaid
flowchart LR
  Browser --> CF[CloudFront]
  CF --> S3[S3 web assets]
  Browser --> ALB[HTTPS ALB]
  ALB --> F[ECS Fargate API]
  F --> RDS[RDS PostgreSQL]
  F --> V[ElastiCache Valkey]
  F --> Obj[S3 attachments]
  GW[ECS general worker] --> RDS
  CW[ECS EC2 channel worker] --> RDS
  CW --> Z[Zapo / WhatsApp]
```
