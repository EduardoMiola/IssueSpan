# Domain, DDD, and module boundaries

Status: **CURRENT design baseline; planned implementation.**

## Strategic DDD

IssueSpan's core domain is the combination of customer context, structured engineering escalation, and customer-impact visibility. Supporting domains include conversations, messaging orchestration, audit, and workspace administration. Generic capabilities include sessions, persistence, queues, telemetry, and object storage.

The ubiquitous language is intentional: **Organization** is the tenant/workspace; **Customer Account** is a supported company; **ChannelConnection** is a configured external channel; **ZapoSession** is infrastructure state; **Conversation** is the support thread; **Message** is a durable inbound/outbound communication; **EngineeringIssue** is the local escalation record; **ExternalIssueLink** points to provider state; **Customer Impact** describes which accounts and conversations are affected.

Bounded contexts:

1. Identity & Access — users, sessions, memberships, invitations, capabilities.
2. Workspace — organizations and configuration.
3. Customer Context — customer accounts, contacts, identity matches, impact facts.
4. Conversation — lifecycle, assignment, messages, timeline projections.
5. Messaging — channel connections, provider delivery, outbox jobs.
6. Escalations — engineering issues, links, status mappings, provider synchronization.
7. Audit — append-only security and business audit records.

## Ownership and aggregates

An aggregate root owns invariants and exposes behavior; a relationship does not automatically imply ownership. A `Conversation` may reference a `CustomerAccount`, but it does not own the account lifecycle. A `Message` is a separate aggregate root because delivery state, provider identifiers, dedupe, retries, and provider acknowledgements have a different consistency boundary from conversation metadata.

Planned roots include `Organization`, `Membership`, `Session`, `CustomerAccount`, `Conversation`, `Message`, `ChannelConnection`, `EngineeringIssue`, and `IntegrationConnection`. `Contact` begins as a customer-context entity/value-bearing record whose identity matching rules are explicit; it is not silently merged into `CustomerAccount` just because a provider exposes a contact object.

`EngineeringIssue` is local IssueSpan state. `ExternalIssueLink` associates it with a GitHub, Linear, or Jira issue without making the provider's aggregate part of IssueSpan's transaction. A provider saying “resolved” never directly resolves a Conversation.

## Tactical patterns

Use value objects for validated concepts such as `OrganizationId`, `ConversationId`, `EmailAddress`, `ProviderIssueKey`, `Cursor`, `ChannelType`, and redacted `SecretReference`. Prefer behavior methods such as `conversation.assignTo()`, `message.markQueued()`, `issue.linkExternalIssue()`, and `membership.revoke()` over public setters that permit illegal states. Domain transitions should be deterministic and reject invalid states with named errors.

## Package shape and import rules

```text
src/modules/<context>/domain
src/modules/<context>/application
src/modules/<context>/ports
src/modules/<context>/adapters
src/runtimes/api | worker | channel-worker
src/shared/telemetry | tenancy | errors | clock
```

Domain imports shared primitives only. Application code may depend on domain and ports. Adapters implement ports and may depend on infrastructure. A context must not query another context's Prisma model directly. Cross-context reads use an application query, a published event, or an explicitly owned read model. This rule applies even while all contexts use one Postgres database.

## One database, logical ownership

Initially there is one Postgres cluster and one migration stream, but each table has a named owning module. Repositories expose tenant-aware methods and return domain projections rather than leaking Prisma types. Cross-module joins are allowed only in an explicitly owned read model or reporting query reviewed for tenant safety.

## Selective CQRS for Customer Impact

Customer impact combines conversations, accounts, engineering issues, and provider status. Recomputing that graph synchronously on every write would couple contexts and increase latency. Keep transactional facts in their owning aggregates, publish durable events, and maintain a denormalized impact read model. This is selective CQRS, not a requirement that every entity have separate read/write models.

## ADR references

See ADR-0001 for modular boundaries, ADR-0009 for local engineering state and provider links, and the data/messaging documents for consistency rules.
