# ADR-0008: One active Zapo owner and partition leases

Status: ACCEPTED

## Decision

Only one worker generation may actively own a Zapo session. Stable logical partitions, leases, heartbeats, and fencing generations are the multi-worker path; uncertain ownership pauses outbound work.
