# IssueSpan product roadmap

## Release targets

### v0.1 Alpha — prove the vertical architecture

Deliver a usable support workflow with WhatsApp/Zapo, inbox and conversations, customer accounts, escalation to an internal engineering issue, GitHub integration, tenant isolation, RBAC, outbox/workers, observability, and production-grade tests.

### v1.0 — portfolio-grade public release

Add Email through Postmark, GitHub/Jira/Linear integration capabilities, connection and operations dashboards, self-hosting documentation, security hardening, load testing, and CI/CD promotion.

## Explicitly deferred

- Generic SMTP as the first email implementation.
- A graph database; PostgreSQL relationships and read models are sufficient initially.
- A microservice split before operational evidence requires it.
- A provider-specific domain model.
- Public customer data, credentials, or production integrations in the repository.
