# ADR-0013: Build once and promote the same digest

Status: ACCEPTED

## Decision

Build, test, scan, and publish one immutable image digest; promote that digest from staging to production. Roll back application digests and use forward fixes for destructive schema changes.
