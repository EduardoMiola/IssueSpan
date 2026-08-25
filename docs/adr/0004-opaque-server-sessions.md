# ADR-0004: Opaque server-side sessions

Status: ACCEPTED

## Decision

Use random opaque Secure HttpOnly cookie tokens, store only hashes, and enforce idle/absolute expiry, rotation, and revocation server-side.

## Rationale

Server control makes logout and privilege changes immediate and avoids trusting tenant claims in browser state. OAuth/OIDC and MFA remain future authentication options.
