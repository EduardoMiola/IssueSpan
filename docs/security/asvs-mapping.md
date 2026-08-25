# OWASP ASVS mapping

Status: **CURRENT deliverable skeleton; evidence populated with implementation.**

IssueSpan uses OWASP ASVS 5.0 as the control vocabulary. The first release targets all applicable Level 1 controls plus selected high-risk Level 2 controls; v1 targets all applicable Level 1 and Level 2 controls. This page maps requirements to evidence instead of claiming certification.

| ASVS area | IssueSpan control / evidence | Status |
| --- | --- | --- |
| V1 Architecture | threat model, trust-boundary diagram, ADRs, abuse cases | PLANNED |
| V2 Authentication | Argon2id, opaque hashed sessions, idle/absolute expiry, rotation | PLANNED |
| V3 Session management | Secure HttpOnly `__Host-` cookie, revoke/list sessions, fixation tests | PLANNED |
| V4 Access control | server-derived TenantContext, capabilities, composite FKs, RLS negative matrix | PLANNED |
| V5 Validation | explicit Zod command schemas, mass-assignment tests, bounded sizes | PLANNED |
| V6 Stored cryptography | KMS/envelope encryption for provider/Zapo secrets; no custom crypto | PLANNED |
| V7 Error handling | RFC 9457 safe errors, trace IDs, no credential/content leakage | PLANNED |
| V8 Data protection | classification, retention, encrypted backups, tenant deletion plan | PLANNED |
| V9 Communications | TLS, Origin/CSRF checks, signed webhooks, replay dedupe | PLANNED |
| V10 Malicious code | dependency lock, review, CodeQL, secret scanning, action pinning | PLANNED |
| V11 Business logic | idempotency, rate limits, last-owner invariant, ambiguous delivery state | PLANNED |
| V12 Files | quarantine, signature/type/size validation, malware scan, signed access | PLANNED |
| V13 API | OpenAPI schemas, BOLA tests, pagination, tenant-filtered SSE | PLANNED |
| V14 Configuration | restricted roles, private DB/cache, security headers, no debug endpoints | PLANNED |
| V15 Architecture | modular boundaries, dependency direction, secure defaults | PLANNED |
| V16 Logging | Pino JSON, trace/span IDs, redaction, append-oriented AuditEvent | PLANNED |
| V17 Testing | security corpus, RLS/RBAC, webhook, SSRF, XSS, failure injection | PLANNED |
| V18 Web services | provider capability adapters, signature verification, timeouts/bulkheads | PLANNED |

## Evidence contract

Each implementation PR should update the relevant row with a code path, test name, configuration evidence, or runbook. A control is not “done” because a library is installed. Security review must answer what is protected, which trust boundary is crossed, what failure looks like, and how the negative case is tested.

## High-risk focus

The first evidence priority is cross-tenant access, session/CSRF/XSS, attachment and SSRF handling, provider webhook forgery/replay, Zapo credential protection, queue payload secrecy, deployment identity, and audit redaction. Any discovered vulnerability becomes a regression fixture and is linked to the security advisory process.
