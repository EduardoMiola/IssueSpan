# Observability and performance

**Status:** Frozen operational requirements.

Use OpenTelemetry traces/metrics/logs and structured Pino. Propagate correlation through HTTP, SSE, database work where safe, outbox, BullMQ, workers, and providers. Controlled dimensions include organization, connection, conversation/message, job, provider operation, worker generation, and release. Never emit bodies, tokens, cookies, or credentials by default.

Track golden signals plus API p50/p95/p99; queue/outbox age; duplicate and delivery failure rates; active sessions/reconnects; lease conflicts/fencing; database pool/slow queries/locks; SSE lag; and per-tenant quota/saturation.

Initial hypotheses: API reads p95 <300ms; command acceptance p95 <500ms when provider is healthy; queued message visible <2s; outbox p95 age <30s; 99.9% API availability; zero tolerated cross-tenant incidents. These are not contractual until measured and distinguish platform acceptance from provider delivery.

Measure before optimizing: indexes/read models, pools, pagination, safe caching, backpressure, then edge caching, partitioned ingestion, quotas, fair scheduling, session placement, cells, and storage partitioning. A million requests per second requires workload clarification, not merely more API replicas. Runbooks cover provider outage, backlog, DB saturation, reconnect storm, credential rotation, suspected tenant leak, and failed deploy.
