# ADR-0011: OpenTelemetry-first observability

Status: ACCEPTED

## Decision

Instrument traces and metrics with OpenTelemetry, use structured Pino logs, and route through a Collector. SigNoz is a reference backend, not a hard application dependency.
