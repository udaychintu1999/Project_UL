# P01-3 — Approved V3 Decisions, Residual Risks and Release Gates

**2026-11-14 owner decision:** P01-3 V1 uses **simple rotating refresh** without response escrow/grace/retry receipts. Device binding and server-purpose-separated secrets were explicitly agreed. The other previously recommended defaults were accepted as the starting implementation contract. Detailed authority: `P01_3_APPROVED_IMPLEMENTATION_CONTRACT_2026_11_14.md`.

**Important distinction:** Approved design does **not** mean permission to begin writing P01-3 code yet. Owner requested updated documentation **before** coding. All runtime/device test status = `NOT IMPLEMENTED / NOT RUN`.

## A. Decisions, explicit and complete

| ID | Final V1 decision | Status |
|---|---|---|
| D13-01 | 30 × 24 h from qualifying interactive auth; silent refresh does not extend reauth clock | APPROVED |
| D13-02 | Opaque 30-minute max access token, memory-first | APPROVED |
| D13-03 | Sliding renewal idle up to 30 days, bounded by overall reauth | APPROVED |
| D13-04 | Single-use refresh token rotated after every successful refresh | APPROVED |
| D13-05 | Non-exportable Android Keystore private signing key and server-verified device proof | EXPLICITLY APPROVED |
| D13-06 | Max 5 active installations, no stealth eviction, revoke individual/all | APPROVED DEFAULT |
| D13-07 | Offline 503/timeout => keep sealed material and Retry; no protected access until checked | APPROVED |
| D13-08 | Logout revokes family; password reset/change invalidates all via epoch; late results fenced | APPROVED |
| D13-09 | Legacy 24h sessions expire naturally; fresh login to enroll | APPROVED |
| D13-10 | Recent auth <=10 minutes for sensitive operations | APPROVED DEFAULT |
| D13-11 | Secure storage failures => safe sign-in, no plaintext fallback | APPROVED |
| D13-12 | **NO** lost-response retry receipts/grace/two-phase protocol; if unrecoverable, fresh login | EXPLICITLY APPROVED |
| D13-13 | Auth/key storage excluded from Android backup and device transfer | APPROVED |
| D13-14 | Random installation ID + optional friendly label, no physical fingerprint | APPROVED |
| D13-15 | Existing password/OTP only; Google and real delivery later | APPROVED |
| D13-16 | Purpose-separated server secret keys, keyed digests and key rotation runbook | EXPLICITLY APPROVED |
| D13-17 | CAS: exactly one successful generation consumption | EXPLICITLY APPROVED |
| D13-18 | Old refresh reuse **always rejected**, no grace | EXPLICITLY APPROVED |

**Engineering choices still requiring evidence, not owner product reapproval:** final native Keystore implementation/library/Android version compatibility; exact bounded PK/SK index; enrollment transaction count and protection against races; DB error classification; secure logout reconciliation; multi-device cap safe overflow UX. These MUST be designed and tested before production implementation signoff, and any meaningful change to the approved behavior requires owner approval.

## B. Risk matrix

| ID | Threat / failure | Mitigation | Acceptance severity |
|---|---|---|---|
| R01 | Stolen refresh token string | Non-exportable Keystore proof **AND** token; strict token digest, no logs | P0 |
| R02 | Old token replay | CAS rotation; old token rejected even with same request ID; sanitized event; revoke family on compromise | P0 |
| R03 | Lost refresh response | Explicit simple fallback reauth, bounded UI, NO acceptance of consumed old token | Accepted UX trade-off |
| R04 | Concurrent legitimate refresh | Flutter single-flight + DynamoDB single-winner CAS; never share independent refresh Future | P0 |
| R05 | Network/DB outage falsely treated as invalid session | Distinguish 503/timeout vs definitive 401; preserve sealed credential | P1 UX |
| R06 | Logout response resurrects signed-in user | Durable local logout intent and generation fencing; server family revocation | P0 |
| R07 | Revoked device still uses valid 30-minute access | Protected endpoints require active family and user epoch | P0 |
| R08 | Password reset/change from second device | Epoch checks on both refresh and access | P0 |
| R09 | Device backup cloning / lost key | Android exclusions and bound signing key; fresh login on loss | HIGH |
| R10 | 30-day deadline bypass by refresh/clock skew | Immutable authenticatedAt; server clock `now >= deadline` denies | P0 |
| R11 | App displays stale account/profile after switch | No private cache before restore, per-user cache partition, in-flight generation checks | P0 |
| R12 | Duplicate enrollment exceeds 5 device limit | Atomic device-slot reservation/condition, no silent eviction | HIGH |
| R13 | Server keys mixed or misrotated | Purpose separation, key IDs, owner-managed rotate/deprecate, startup fail closed | P0 |
| R14 | Public session metadata leak | User-owned bounded Query; recent auth; no IDOR | HIGH |
| R15 | Remote HTTP/actual provider operations | No remote transport in P01-3, production TLS/cloud gate separately | P0 production |
| R16 | Existing-account signup reveals presence | Accepted P01-2 product behavior, logged privacy trade-off; not modified by sessions | Existing risk |

## C. Standards and claims

- NIST SP 800-63B-4 recommends AAL1 overall reauthentication of no more than 30 days; a distinct inactivity rule may be applied. Persistent session secrets based on cryptographic proof-of-possession MAY be used subject to lifetime checks. <https://pages.nist.gov/800-63-4/sp800-63b/session/>
- RFC 9700 refresh rotation and sender constraints inform the design. Refresh-token replay can reveal compromise and under OAuth security recommendations can revoke the active family; a bespoke U_luv protocol is not inherently OAuth or NIST certified. <https://www.rfc-editor.org/rfc/rfc9700.html#section-4-14>
- A simple rotating scheme **can cause a rare early login prompt** when a committed refresh response is lost. This is an acknowledged trade-off, not a promise of perfect recovery.

## D. Required release gates

- All new P01-3 automated tests actually executed and PASS or explicit technical blocker recorded. **Never label an unavailable device test PASS.**
- Concurrent refresh CAS **real DynamoDB** proof; 30d exact boundary; reused token always rejected; password epoch and family revocation; key proof; backup/reinstall; logout fencing and No-Back-to-P00.
- Physical Android cold-start/reboot/restore/offline/logout tests and targeted manual owner checks after feasible automation.
- Preserve all P01-2 owner-accepted flows and verified shared five-email budget. Keep P01-1 local-development Android E2E exception visible, not green.
- 18-table schema, no AWS, no real SES/Google provider, no payment, no real secrets in packages.
- Revised docs/QA evidence and final user acceptance **after** implementation.

## E. Coding authorization status

**NO CODE YET:** Owner asked: "First give complete updated docs, then we can proceed with coding." The design package fulfills that request only. Request a separate explicit go-ahead to implement P01-3.
