# ADR-0002: Runtime process separation

Status: ACCEPTED

## Decision

Deploy web, api, worker, and channel-worker as separate runtimes while keeping one modular codebase initially.

## Rationale

HTTP, general jobs, and long-lived Zapo sessions have different restart, scaling, memory, and failure profiles. Separate processes reduce blast radius without prematurely creating service boundaries.
