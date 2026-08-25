# API contracts, observability, and operations

Status: **CURRENT baseline; planned implementation.**

The operator question is: “Why is this WhatsApp connection not working?” Monitoring can say that failure count increased. Observability must connect the specific Organization, ChannelConnection, ZapoSession, provider event, lease generation, retry, and incident without exposing secrets or transcript content.

## Telemetry

OpenTelemetry is the instrumentation boundary: traces and metrics from API, workers, and channel-workers go to an OpenTelemetry Collector. Pino JSON logs carry `trace_id`, `span_id`, `correlation_id`, `organization_id` only when safe, `channel_connection_id`, `session_id` surrogate, job/event IDs, and outcome. SigNoz is a reference backend, not an application dependency or hosted-service promise.

Async boundaries use propagated context or span links. Session lifecycle spans are short connect/handshake/reconnect attempts; never keep a trace open for days. Sampling is higher for errors and incidents. Cardinality rules prohibit raw phone numbers, email addresses, message bodies, arbitrary provider IDs, and unbounded labels in metrics.

`ChannelConnectionRuntimeStatus` is a projection, not the socket itself. It should answer state, last transition, last successful provider interaction, current owner generation, reconnect count/window, redacted error category, and diagnostic freshness. `ChannelIncident` has a fingerprint, state, first/last seen, severity, affected connection/session, evidence references, and acknowledgement/resolution metadata.

Workspace diagnostics explain a customer's connection. A future platform operations console handles fleet-level worker health, leases, queue lag, and provider incidents. These views have different authorization and data minimization rules.

## HTTP contract

Use `/api/v1`, nouns, tenant-scoped authorization, and command endpoints only where an action is not naturally a resource mutation. `201 Created` represents a created durable resource—even if Message delivery is queued. RFC 9457 Problem Details standardizes errors. Cross-tenant access returns a not-found-shaped response. List endpoints use bounded cursor pagination. `ETag`/`If-Match` protects concurrent edits. OpenAPI 3.1 is the contract baseline and generated clients stop provider DTOs at the adapter boundary.

Runbooks and API documentation are release artifacts. A change is incomplete when the endpoint works but the operator cannot diagnose its failure mode.
