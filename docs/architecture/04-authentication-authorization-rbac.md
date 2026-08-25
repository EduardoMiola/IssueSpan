# Authentication, authorization, and RBAC

Status: **CURRENT baseline; planned implementation.**

Authentication proves who the user is. Tenant resolution identifies the Organization from the server-side session and membership. Authorization checks whether that principal can perform the operation on that resource. These are separate steps and must remain separate in code and tests.

## Sessions and credentials

The browser receives an opaque random session ID in a `Secure`, `HttpOnly` cookie. The database stores only a strong hash of the token, with idle and absolute expiry, revocation, last-seen metadata, and rotation on privilege-sensitive events. Logout and administrative revocation invalidate the server record. There is no user identity or tenant authority encoded as trusted client state.

Passwords use Argon2id with a reviewed memory/time policy. Password reset and invitation tokens are random, one-use, short-lived, hashed at rest, and consumed atomically. Recovery flows do not reveal whether an email exists.

SameSite and Origin checks reduce CSRF exposure; state-changing cookie-authenticated requests also require an explicit CSRF strategy. CSP, output encoding, and safe redirects address XSS and session theft. Rate limits and lockout controls must avoid creating an easy denial-of-service against a legitimate account.

## Capabilities over role strings

The initial roles are `OWNER`, `ADMIN`, and `AGENT`, but handlers check capabilities such as `conversation:assign`, `integration:manage`, `member:invite`, and `audit:read`. Roles map to capabilities in policy code so a future custom role does not require scattering role-name comparisons.

An Organization must always retain at least one active owner. Transfer and deletion are transactions that enforce the last-owner invariant. Membership changes, invitation acceptance, resets, session revocations, and role changes emit audit records.

Machine/API tokens, OAuth/OIDC, MFA, and passkeys are later capabilities. Their addition must preserve TenantContext derivation, scoped permissions, rotation, revocation, and auditability.
