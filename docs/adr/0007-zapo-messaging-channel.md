# ADR-0007: Zapo behind MessagingChannel

Status: ACCEPTED

## Decision

Zapo/WhatsApp is the v0.1 flagship channel, isolated behind a MessagingChannel port and adapter. Domain code never imports its SDK or session state.
