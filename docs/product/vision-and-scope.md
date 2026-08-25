# Product vision and scope

Status: **CURRENT product definition; implementation is early development.**

> **IssueSpan is the support workspace where customer context, structured engineering escalation, and customer impact stay connected.**

Formally, IssueSpan is a multi-tenant B2B support system that receives conversations, maintains a durable Customer Account context, and links support work to Engineering Issues without surrendering customer-impact truth to a provider.

## ICP and anti-ICP

The ICP is a B2B software team with a technical support motion, recurring escalations, and customers whose business impact matters. The anti-ICP is a consumer helpdesk seeking massive generic ticket volume, a CRM replacement requiring sales automation, or a company that needs a full project-management suite before customer context is valuable.

The wedge is not another inbox. It is the chain `Customer Account → Conversation → Engineering Issue → Impact`, with enough provider integration to make the chain useful and enough local ownership to preserve context.

## Core entities

Organization, User, Membership, Customer Account, Contact, Conversation, Message, ChannelConnection, ZapoSession, EngineeringIssue, IntegrationConnection, ExternalIssueLink, CustomerImpactFact, and AuditEvent have distinct meanings. A Customer Account may have many contacts and conversations; an EngineeringIssue may affect many accounts; a provider issue is linked, not owned.

## Scope

v0.1 is the walking skeleton: Organizations/memberships, sessions/RBAC, Zapo/WhatsApp connection, inbound/outbound Conversation and Message flow, durable outbox, worker/channel-worker separation, API, React inbox shell, SSE invalidation, tenant isolation/RLS, OpenTelemetry baseline, Docker local environment, and GitHub integration depth sufficient for a real escalation flow.

v1.0 adds Email end to end through Postmark, stronger Customer Impact projections, Linear support, Jira core integration, richer diagnostics, attachments, provider lifecycle reconciliation, and production deployment hardening.

Email follows Zapo because it proves a different channel shape: managed webhooks and delivery states, not a long-lived session. GitHub is full first because the initial engineering workflow is GitHub-centric. Linear is second/full to prove the adapter abstraction. Jira is core with explicit complexity; a generic link is always the low-capability fallback.
