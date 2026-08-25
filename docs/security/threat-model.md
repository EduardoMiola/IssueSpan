# IssueSpan security threat model

**Status:** Frozen security requirements.

Assets: tenant identity and memberships, sessions, customer/conversation data, Zapo auth state, provider tokens, attachments, audit, queues, webhooks, logs, and traces. Boundaries are browser/API, API/domain, worker/queue, channel worker/provider, object storage, and provider webhooks.

| Threat | Control |
|---|---|
| Cross-tenant access | session membership, scoped queries, RLS defense in depth, negative tests |
| Privilege escalation | deny-by-default capabilities at API and domain |
| Session theft/CSRF | Secure HttpOnly SameSite cookies, CSRF strategy, rotation/revocation |
| Webhook spoof/replay | signature, timestamp/nonce, inbox deduplication |
| Credential leak | secret manager, encryption, redaction, no raw payload by default |
| HTML/attachment attack | sanitization, blocked external images, size/type limits, malware path |
| Queue poisoning/SSRF | schema validation, scoped idempotency, outbound allowlists |
| Noisy neighbor | tenant/endpoint limits, quotas, fair queues |
| Stale owner | lease, generation/fencing, single-writer checks |
| Telemetry leakage | attribute allowlist, redaction, retention, access control |

Invariants: no resource access without membership capability; no job without organization context; no provider mutation before authenticity/dedup; no stale worker action after takeover. Verify with authorization matrices, cross-tenant tests, replay tests, fuzzing, dependency/container/secret scans, and Jira IS follow-up.
