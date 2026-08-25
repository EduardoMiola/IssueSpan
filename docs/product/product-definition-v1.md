# IssueSpan product definition v1

**Status:** Frozen product baseline · **Owner:** Eduardo Miola · **Jira:** [IS](https://issuespan.atlassian.net/browse/IS)

## Problem and ICP

Small B2B software teams run support in a shared inbox/helpdesk while engineering works in GitHub, Jira, or Linear. When a technical conversation crosses that boundary, context is copied manually and customer impact disappears. IssueSpan’s wedge is continuity between customer conversation and engineering impact, not generic ticketing.

The ICP is a B2B SaaS/software company of roughly 10–75 people, 2–12 support users, an internal engineering team, and recurring technical questions. The strongest trigger is support regularly needing engineering. Anti-ICP: consumer-scale support, no engineering collaboration, full enterprise ITSM, and broad omnichannel parity on day one.

Owner configures organization and policy; Admin manages access; Agent resolves conversations; Support lead monitors queues and impact; Engineer receives context; Product manager understands affected accounts.

## Scope

v0.1: organizations, memberships, Owner/Admin/Agent capabilities, customer accounts and contacts, conversations/messages, assignment, Open/Pending/Resolved, notes, tags, search, notifications, audit, WhatsApp/Zapo, escalation/customer-impact read model, GitHub adapter first, tenant isolation, sessions, rate limits, outbox, workers, telemetry, and tests.

v1.0: Email through EmailProvider with Postmark first, GitHub/Jira/Linear capabilities, operations dashboards, self-hosting, hardening, load testing, and CI/CD promotion.

Deferred: generic SMTP first, graph database, early microservices, provider-specific domain models, public customer data, and production credentials.

## Critical workflows

1. Normalize, deduplicate, and persist inbound events.
2. Commit outbound message plus outbox, return queued state, and send asynchronously.
3. Record impact and context, then create/link a provider issue.
4. Verify and deduplicate webhooks before async processing.
5. Enforce membership capabilities on every protected action.

Correctness and privacy beat aggressive automation: a false split is inconvenient; a false merge can expose one customer’s conversation to another.
