# IssueSpan execution backlog

Jira is the delivery system of record. The keys below are the planned sequence; existing keys must be checked before creating duplicates.

## Epics

| Group | Scope |
|---|---|
| E0 | Engineering Foundation |
| E1 | Identity & Workspace |
| E2 | Customer Support Core |
| E3 | Messaging Reliability |
| E4 | WhatsApp / Zapo |
| E5 | Engineering Impact |
| E6 | Email Channel |
| E7 | Operations & Observability |
| E8 | Security & Hardening |
| E9 | Cloud & Release Engineering |
| E10 | OSS v1 |

## Foundation sequence

1. `IS-13` — Repository foundation (already referenced by the initial README)
2. Repository documentation and architecture constraints
3. Monorepo workspace and package boundaries
4. Local development services: PostgreSQL and Valkey
5. Fastify API and health/readiness contracts
6. Prisma schema foundation and tenant-aware persistence
7. Transactional outbox and worker runtime
8. Session authentication and membership authorization
9. React web shell and workspace routing
10. CI quality gates and pull-request rules

## Definition of done for each task

- Jira acceptance criteria are explicit and testable.
- The implementation is on a feature branch named with the Jira key.
- Tests or executable checks cover the changed behavior.
- Documentation and configuration are updated with the change.
- A GitHub pull request links the Jira issue and explains validation.
- No credentials, tenant data, or unrelated changes are included.

## Jira tasks created after the foundation sequence

| Jira | PR | Epic | Focus |
|---|---:|---|---|
| [IS-23](https://issuespan.atlassian.net/browse/IS-23) | 17 | Engineering Impact | GitHub engineering provider |
| [IS-24](https://issuespan.atlassian.net/browse/IS-24) | 18 | Engineering Impact | Escalation and customer-impact read model |
| [IS-25](https://issuespan.atlassian.net/browse/IS-25) | 15 | WhatsApp / Zapo | Zapo messaging adapter |
| [IS-26](https://issuespan.atlassian.net/browse/IS-26) | 11 | Identity & Workspace | Tenant isolation and PostgreSQL RLS |
| [IS-27](https://issuespan.atlassian.net/browse/IS-27) | 16 | WhatsApp / Zapo | Channel-worker ownership and reconnect |
| [IS-28](https://issuespan.atlassian.net/browse/IS-28) | 14 | Customer Support Core | Conversation assignment and lifecycle |
| [IS-29](https://issuespan.atlassian.net/browse/IS-29) | 12 | Identity & Workspace | Session authentication and capability RBAC |
| [IS-30](https://issuespan.atlassian.net/browse/IS-30) | 13 | Customer Support Core | Customer accounts and contacts |
| [IS-31](https://issuespan.atlassian.net/browse/IS-31) | 19 | Email Channel | Email channel with Postmark |
| [IS-32](https://issuespan.atlassian.net/browse/IS-32) | 20 | Operations & Observability | Audit, OpenTelemetry and operations |

All ten tasks were created as Jira `Tarefa`, assigned to Eduardo Ceron, and left in `Tarefas pendentes`.
