# IssueSpan documentation

## Source of truth

GitHub documentation is the source of truth for architecture, product scope, security, operations, and implementation guidance. Jira is the delivery system of record: issue ownership, sequencing, acceptance criteria, dependencies, and progress live there. ADRs are the decision history: they record why a choice was made, what alternatives were rejected, and when it may be revisited.

When sources disagree, do not silently edit the prose. Open or update the Jira issue, record the decision in an ADR, then update the affected deep document and executive definition. README is the public orientation, not the detailed architecture source.

## Map

- [Product vision and scope](product/vision-and-scope.md) and [roadmap](product/roadmap.md)
- [Architecture Definition v1](architecture/architecture-definition-v1.md) and [deep architecture](architecture/01-fundamentals-and-system-shape.md)
- [Security threat model](security/threat-model.md) and [controls](security/security-controls.md)
- [Testing strategy](testing/testing-strategy.md)
- [Docker/local](deployment/docker-and-local-development.md), [AWS/CI](deployment/aws-and-cicd.md), [capacity](performance/capacity-and-scale.md)
- [Runbooks](operations/runbook-index.md), [execution backlog](execution/backlog.md), and [ADRs](adr/README.md)

Labels CURRENT, PLANNED, DEFERRED, and PROPOSED describe maturity. Documentation must never imply that a planned component is implemented.
