# Security controls

- Cookies: Secure, HttpOnly, appropriate SameSite, narrow scope, rotation, idle/absolute expiry, server revocation, and CSRF protection.
- Tenancy: mandatory TenantContext, RLS, composite tenant-aware FKs, repository scoping, and a cross-tenant negative test matrix.
- Secrets: Secrets Manager or equivalent, encrypted references, no secrets in logs, traces, screenshots, fixtures, or browser state.
- Storage: private buckets, short-lived signed URLs, object-type/size validation, quarantine and scan hooks, lifecycle retention.
- Webhooks: provider signature verification, replay protection, dedupe inbox, bounded parsing, and least-privilege ingress.
- SSRF: no arbitrary URL fetch; scheme/host/IP validation, egress policy, timeouts, response-size limits, and revalidation.
- Browser safety: CSP, output encoding, safe HTML sanitization, no unsafe inline scripts, and secure redirect allowlists.
- Supply chain: dependency review, lockfile, CodeQL, secret scanning, push protection, least-privilege Action permissions, SHA-pinned sensitive actions, and GitHub OIDC federation to AWS.

Controls must be testable and linked to a runbook or evidence artifact. A checkbox without a negative test, configuration check, or review rule is not proof.
# IS-15 authentication controls

Status: **CURRENT for the controls below; broader security work remains PLANNED.**

- Argon2id password hashes and opaque session credentials are never logged; PostgreSQL stores only a SHA-256 session-token hash.
- Production session cookies are Secure, HttpOnly, SameSite=Lax, Path=/, and no-Domain. Authenticated mutations require exact Origin and CSRF header/cookie validation.
- Tenant authority is derived from Membership, not a client organization ID, and tenant-owned access remains protected by transaction-local PostgreSQL RLS.
