# Threat model

Status: **CURRENT design control; versioned with the repository.** Target: OWASP ASVS 5.0 L1, with selected L2 controls for tenant isolation, sessions, webhooks, and secrets.

Trust boundaries are the browser/API, API/Postgres, API/Valkey, object storage, external providers, inbound webhooks, Zapo state, and AWS/CI. STRIDE and abuse cases cover spoofing, tampering, repudiation, information disclosure, denial of service, and elevation of privilege.

Top threats and controls: cross-tenant access is addressed by server-derived TenantContext, composite constraints, repository scoping, RLS, and negative tests; stolen sessions by opaque hashed tokens, Secure HttpOnly cookies, rotation, expiry, revocation, CSRF controls, and CSP; SSRF by allowlisted outbound targets and no arbitrary webhook fetch; HTML/email/attachments by sanitization, safe rendering, quarantine, size/type limits, and scanning interfaces; forged/replayed webhooks by signature verification, timestamp/replay windows, inbox dedupe, and audit; secret leakage by secret stores, redaction, least privilege, and push protection; Zapo split brain by leases, generations, pause-on-uncertainty, and reconciliation; supply-chain compromise by lockfiles, dependency review, CodeQL, secret scanning, pinned sensitive Actions, and OIDC.

Residual risks are provider-side ambiguity, compromised dependency/runtime, malicious tenant administrators, metadata leakage, and operational mistakes during recovery. Incidents must record evidence without copying customer transcripts or secrets.
