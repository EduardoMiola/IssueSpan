# Authentication, authorization, and RBAC

Status: **CURRENT authentication, opaque-session, TenantContext, and initial policy foundation implemented in IS-15. Advanced RBAC hardening remains PLANNED for IS-29.**

## IS-15 implementation evidence

`apps/api` provides `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, and `GET /api/v1/me`. Passwords use Argon2id with OWASP's minimum 19 MiB / 2 iterations / parallelism 1; parameters are encoded in each hash and a successful login can rehash after policy changes. Authentication failures are generic.

Sessions are 256-bit Node crypto tokens. PostgreSQL stores only their SHA-256 hash, idle and absolute expirations, revocation, last-seen, and auth method. Cookies are HttpOnly, SameSite=Lax, Path=/, no-Domain, `__Host-` in production, and Secure in production; local HTTP deliberately uses a differently named development cookie. Logout revokes server state before clearing cookies.

HttpOnly does not solve XSS. Browser mutations require a non-authentication CSRF cookie paired with `X-CSRF-Token` plus exact configured Origin validation, which addresses CSRF. The API runs through `DATABASE_APP_URL` as the restricted runtime role. `withTenantTransaction` applies the organization selector as transaction-local scope, proves the authenticated user's Membership under RLS, and only then returns `{ userId, organizationId, membershipId, role }` to application work. The centralized capability foundation is CURRENT; full RBAC hardening and durable audit storage are **DEFERRED** to IS-29 and IS-32.

The first API boundary also applies an in-process, IP-plus-email, five-attempt/15-minute login rate limit. It is deliberately non-authoritative and process-local; distributed Valkey enforcement is **DEFERRED** until deployment topology and measured abuse require it.

Authentication proves who the user is. Tenant resolution identifies the Organization from the server-side session and membership. Authorization checks whether that principal can perform the operation on that resource. These are separate steps and must remain separate in code and tests.

## Sessions and credentials

The browser receives an opaque random session ID in a `Secure`, `HttpOnly` cookie. The database stores only a strong hash of the token, with idle and absolute expiry, revocation, last-seen metadata, and rotation on privilege-sensitive events. Logout and administrative revocation invalidate the server record. There is no user identity or tenant authority encoded as trusted client state.

Passwords use Argon2id with a reviewed memory/time policy. Password reset and invitation tokens are random, one-use, short-lived, hashed at rest, and consumed atomically. Recovery flows do not reveal whether an email exists.

SameSite and Origin checks reduce CSRF exposure; state-changing cookie-authenticated requests also require an explicit CSRF strategy. CSP, output encoding, and safe redirects address XSS and session theft. Rate limits and lockout controls must avoid creating an easy denial-of-service against a legitimate account.

## Capabilities over role strings

The initial roles are `OWNER`, `ADMIN`, and `AGENT`, but handlers check capabilities such as `conversation:assign`, `integration:manage`, `member:invite`, and `audit:read`. Roles map to capabilities in policy code so a future custom role does not require scattering role-name comparisons.

An Organization must always retain at least one active owner. Transfer and deletion are transactions that enforce the last-owner invariant. Membership changes, invitation acceptance, resets, session revocations, and role changes emit audit records.

Machine/API tokens, OAuth/OIDC, MFA, and passkeys are later capabilities. Their addition must preserve TenantContext derivation, scoped permissions, rotation, revocation, and auditability.

## Session and token lifecycle

```text
login → Argon2id verification → hash opaque session token
  → Secure HttpOnly cookie → authenticate User
  → resolve Organization membership/capabilities
  → idle/absolute expiry → revoke or rotate
```

Store a SHA-256 hash of a 256-bit random token, never the raw token. Use `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Domain`, and `__Host-` where possible. HttpOnly does not solve XSS; mutations still need CSRF tokens/custom headers plus Origin verification. Generic login/reset responses prevent enumeration. Rate limiting combines IP and account signals without permanent lockout.

Invitations and password resets use one-use high-entropy hashed tokens with expiry, revocation, and atomic consume. Invitation role grants require capability. Reset and role changes revoke or rotate sessions and emit safe AuditEvents. Provider credentials and Zapo keys never enter browser responses.

Use `authorization.require(ctx, Permission.X)` over role-name branches. OWNER/ADMIN/AGENT are defaults; capabilities cover members, channels, CustomerAccounts, Conversations, InternalNotes, Escalations, audit, and webhooks. Last-owner removal and Admin self-promotion are business-invariant tests.
