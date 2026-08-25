# Runbook: provider credentials and rate limits

Status: **PLANNED.**

## Identify

Separate invalid credentials, revoked authorization, provider throttling, network failure, and malformed requests. Use integration status, safe error codes, webhook health, queue age, and provider documentation. Never expose the credential or raw authorization response.

## Mitigate

Open an integration incident and apply a provider/Organization bulkhead. Stop infinite retries. Rate limits use provider-aware backoff; credential failures require reauthorization or rotation. Preserve local EngineeringIssue, Conversation, and CustomerAccount impact even when the provider is unavailable.

## Recover

Reauthorize with least scope, validate the connection, reconcile current provider state, and replay only bounded idempotent work. For webhooks, verify raw-body signature and delivery dedupe before accepting recovery traffic. Close the incident only after inbound and outbound probes succeed.
