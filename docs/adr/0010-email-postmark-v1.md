# ADR-0010: Email in v1 via Postmark and a managed provider

Status: ACCEPTED

## Decision

Include Email in v1 through Postmark first, behind EmailProvider, using the general worker and webhook/delivery model. Do not run an MTA in v1.
