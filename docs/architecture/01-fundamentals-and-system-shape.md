# Fundamentals and system shape

Status: **CURRENT baseline for the planned product; implementation is not claimed.**

## Architecture drivers

IssueSpan optimizes in this order: (1) security and tenant isolation, (2) correctness and reliability, (3) evolvability, (4) operability, (5) scalability, (6) performance, (7) cost, and (8) developer experience. A faster design that can leak one organization into another is not an acceptable trade. A cheaper design that loses an escalation or duplicates a provider side effect is not an acceptable v0.1.

## Modular monolith first

The initial deployable is one repository and one logical application with explicit modules, not a distributed collection of services. A modular monolith keeps transactions, local refactors, tests, and the first walking skeleton understandable while preserving boundaries that can later become processes or services.

Microservices are deferred because independent deployment is not yet worth distributed transactions, network failure, duplicated auth/tenant enforcement, schema versioning, and a larger operational surface. A module may be extracted when it has a stable contract, an independent scaling or failure-isolation need, and measured operational evidence. “We can deploy it separately” is not sufficient evidence.

## Ports and Adapters

Dependencies point inward:

```text
HTTP / SSE / jobs / webhooks / channel runtimes
                    ↓
          adapters and application commands
                    ↓
       domain modules and use-case policies
                    ↓
        ports (repositories, providers, clock)
                    ↓
 Postgres / Valkey / object storage / GitHub / Zapo / Postmark
```

Domain code must not import Express/Fastify, Prisma, BullMQ, Zapo, Postmark, or provider DTOs. Adapters translate at the boundary. A port is warranted when it protects a domain decision or makes a failure mode testable; a port for every trivial helper creates ceremony without isolation.

## Runtime processes

The planned applications are `web`, `api`, `worker`, and `channel-worker`. `web` serves the React application. `api` owns synchronous HTTP, authorization, commands, queries, SSE, and webhook ingress. `worker` consumes general jobs such as outbox delivery, provider synchronization, email, and projections. `channel-worker` owns long-lived Zapo sessions and their process-local runtime state.

Separating processes gives each workload its own restart, memory, file-descriptor, and scaling boundary. It does not imply four microservices: they share modules and a database contract while remaining independently deployable runtimes.

## C4 reading guide

- **Context:** an Organization's support team uses IssueSpan to receive customer conversations, understand Customer Accounts, and coordinate Engineering Issues with GitHub/Linear/Jira.
- **Container:** web, api, worker, channel-worker, Postgres, Valkey, object storage, and external providers.
- **Component:** bounded-context modules, adapters, outbox relay, session supervisor, impact projection, and diagnostics projection.
- **Code:** aggregates, value objects, application services, ports, repositories, and transport handlers.

The diagrams in these documents deliberately use plain text or Mermaid-compatible notation so a reviewer can read them without a diagram tool.

## Process and failure boundaries

An API request may commit business state and outbox intent in one transaction. It must not wait for GitHub, Postmark, or WhatsApp to succeed before returning a durable local result. Workers retry asynchronous work. Channel workers may be unavailable without taking down the API. When ownership of a Zapo session is uncertain, correctness wins over availability and outbound work is paused.

## “1M RPS” is not a requirement

Before accepting a scale claim, ask: one million requests per second of which endpoint, for which tenant mix, with what read/write ratio, payload size, durability requirement, and provider side effects? It is 86.4 billion requests per day, but an API read, an outbox insert, a Zapo event, and a fan-out notification are different workloads.

For read-heavy traffic, use cached/read models, bounded payloads, keyset pagination, replicas where safe, and load shedding. For writes, protect Postgres with admission control, queueing, backpressure, idempotency, and per-tenant budgets. Fairness prevents one organization from consuming all connections or queue workers. Cells—an independently operated slice of tenants and channels—are a later evolution when a single database or worker fleet becomes the failure domain. They are not justified by a headline RPS number alone.

## Evolution rule

Measure first. Extract a worker or module when a concrete bottleneck or blast-radius problem is reproducible. Keep contracts versioned, tenant-aware, observable, and idempotent before moving a boundary across the network.

## Pattern guide and scale conversation

Modular Monolith is a deployment style; Ports & Adapters controls dependency direction; Adapter, Strategy, and Factory vary providers; Repository and Unit of Work isolate persistence; Outbox, idempotency, retry/backoff/jitter, circuit breaker, and bulkhead address distributed failure; leases and fencing address ownership; selective CQRS addresses relationship-heavy reads. Do not add a pattern without the failure mode it solves. In particular, do not add CQRS everywhere, a circuit breaker around local code, or distributed leases before the one-worker Zapo runtime is correct.

“One million RPS” is not a requirement until the workload is named: read/write mix, payload, consistency, latency, region, burst, tenant skew, availability, and cost. Sustained 1M RPS is 86.4 billion requests/day; at roughly 1 KB it is roughly 86 TB/day raw ingress before response, replication, and telemetry. Read-heavy traffic may use caches/CDNs; durable writes need partitioned ingestion/storage, backpressure, load shedding, and tenant fairness.

`apps/web`, `apps/api`, `apps/worker`, and `apps/channel-worker` are composition roots. Domain packages do not import Fastify, Prisma, Redis/BullMQ, Zapo, React, or AWS SDK types. This keeps future extraction possible without pretending that v0.1 is already microservices.
