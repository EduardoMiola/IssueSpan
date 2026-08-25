# ADR-0001: Modular monolith and Ports & Adapters

Status: ACCEPTED

## Context

The first product needs strong boundaries without distributed-system overhead.

## Decision

Use a modular monolith with explicit bounded contexts and Ports & Adapters. Dependencies point inward; adapters translate infrastructure and provider contracts.

## Alternatives and consequences

Microservices now would increase network failure and deployment cost without measured need. The monolith is simpler to test and evolve, but requires import rules and ownership discipline. Extract only with evidence.
