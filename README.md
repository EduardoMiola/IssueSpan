# IssueSpan

Support and engineering, in context.

IssueSpan is an open-source customer support platform for B2B software teams where support and engineering work together.

The project is created and maintained by [Eduardo Miola](https://github.com/EduardoMiola).

> The repository foundation is being prepared in [IS-13](https://issuespan.atlassian.net/browse/IS-13).

**Status:** repository foundation and architecture documentation; product runtime is not implemented yet.

## Product promise

IssueSpan connects customer context, support conversations, and engineering impact for small B2B software teams. Initial scope covers organizations, memberships, customers, conversations, assignment, status, notes, tags, search, audit, WhatsApp/Zapo, escalations, asynchronous delivery, tenant isolation, observability, and tests.

~~~text
React web → Fastify API → PostgreSQL + transactional outbox
                            ↓
                      worker → BullMQ/Valkey
                            ↓
                 channel-worker → Zapo/WhatsApp
~~~

This is a modular monolith in one repository. Runtime processes are separated where lifecycle and scaling differ; bounded contexts are not prematurely deployed as microservices.

## Documentation

- [Documentation index](docs/README.md)
- [Architecture Definition v1](docs/architecture/architecture-definition-v1.md)
- [Product definition](docs/product/product-definition-v1.md)
- [Domain/data architecture](docs/architecture/domain-data-architecture.md)
- [Messaging/channels/integrations](docs/architecture/messaging-channels-integrations.md)
- [API/frontend](docs/architecture/api-frontend.md)
- [Channel workers](docs/architecture/channel-workers.md)
- [Threat model](docs/security/threat-model.md)
- [Testing strategy](docs/testing/testing-strategy.md)
- [Deployment and CI/CD](docs/operations/deployment-and-cicd.md)
- [Observability/performance](docs/operations/observability-performance.md)
- [ADR index](docs/adr/README.md)

## Project documents

- [Architecture Definition v1](docs/architecture/architecture-definition-v1.md)
- [Product roadmap](docs/product/roadmap.md)
- [Execution backlog](docs/execution/backlog.md)
- [Engineering instructions](AGENTS.md)
