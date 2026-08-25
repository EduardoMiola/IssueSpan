# Engineering integrations and Customer Impact

Status: **CURRENT product boundary; adapters planned.**

IssueSpan owns customer context, escalation context, and impact. GitHub, Linear, and Jira remain sources of truth for provider-native issue facts. The `EngineeringIssueProvider` port exposes capabilities—create, fetch, update status, comment, webhook verification, and rate-limit metadata—rather than pretending every provider supports the same operations.

`IntegrationConnection` stores tenant-scoped configuration and secret references. `ExternalIssueLink` stores provider, external ID/key, URL, and synchronization metadata. Creating a provider issue is asynchronous: commit local EngineeringIssue and outbox intent first, then let a worker call the adapter. This makes provider downtime visible without rolling back local customer-impact state.

Webhooks enter an authenticated inbox with signature verification, replay protection, event dedupe, and recorded ordering assumptions. Processing is idempotent and may reconcile by fetching current provider state. GitHub is the first full adapter. Linear is the second adapter because its model tests whether the port is real rather than GitHub-shaped. Jira is core but more complex: webhook refresh, lifecycle/status variation, and tenant-specific configuration need explicit capability handling. A generic link is always available without pretending to synchronize.

Map provider statuses into canonical states with `UNKNOWN` fallback and preserve the raw provider status. **Engineering `RESOLVED` never auto-resolves a Conversation.** Customer communication and support ownership are separate decisions; an agent must intentionally resolve or update the conversation.

Do not send transcripts, ARR, contacts, or customer dumps to a provider by default. An internal note is not a provider comment. Comments require an explicit user action, a policy check, redaction, and an audit record.

The Customer Impact read model links Customer Accounts, Conversations, EngineeringIssues, and external status facts. A graph database is deferred: Postgres projections, indexes, and bounded traversals provide simpler transactions and operations first. Per-provider rate limits, bulkheads, circuit breakers, and backoff isolate provider failure.
