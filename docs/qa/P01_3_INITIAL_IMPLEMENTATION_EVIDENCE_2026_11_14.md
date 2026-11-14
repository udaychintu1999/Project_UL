# CURRENT AUTHORITATIVE CHECKPOINT — P01-3 OWNER-ACCEPTED (2026-11-14)

**P00:** `CORE_FLOW_VERIFIED` (historical owner evidence). **P01-1:** manually accepted; its standalone Android OTP automation remains **FAILED**, explicitly accepted for *local development only* (never report PASS or production waiver). **P01-2:** owner-accepted after Windows automated and manual testing. **P01-3:** **OWNER-ACCEPTED for local development** after complete `npm run verify:p01-3` automated pipeline PASSED on Windows/physical Android and the owner reported that final manual phone testing worked as expected. **P02:** NOT STARTED; next is P02 specification/design review, not automatic authorization to implement.

**Evidence:** `docs/qa/P01_3_OWNER_ACCEPTANCE_2026_11_14.md` (current) and historical `docs/qa/P01_3_INITIAL_IMPLEMENTATION_EVIDENCE_2026_11_14.md`. A real 30-day elapsed-time field observation and production/security/provider readiness have **not** been demonstrated by these logs; automated 30-day boundary tests passed. Do not equate owner acceptance of local development with production release. Java DynamoDB Local remains the database through P16; no AWS/email-provider/payments integration is authorized by this acceptance. Earlier status blocks below are preserved as dated history, not current instructions.

---

# P01-3 V1 — Initial implementation evidence (2026-11-14)

**Status: IMPLEMENTED IN SOURCE / PARTIALLY VERIFIED — NOT OWNER ACCEPTED.**

P01-2 remains owner-accepted per the owner's Windows/physical-Android and manual confirmation. P01-1 Android OTP E2E remains the prior owner-accepted *local-development-only* automation failure, never recorded as PASS. P02 remains untouched.

## Implementation scope

- Fastify routes `/v1/auth/device/enroll`, `/refresh`, `/logout`, `/list`, `/revoke` use existing `uluv_auth_links` and `uluv_users` (no 19th table/GSI, no Scan).
- One exact device row per `USER#uid / DEVICE#0..4`; at most five live slots, expired/revoked slots reclaimable without evicting live ones.
- Each enrollment uses an existing **recent** interactive access bearer and a P-256 signed canonical proof; consumes the legacy access bearer within the transaction and creates a bound access credential.
- New access tokens are opaque 32-byte random values, expiring in at most 1,800 seconds, with a purpose-derived HMAC lookup. Renewable token digest is separate, with a non-secret v1 key ID.
- Refresh verifies canonical signed proof, active adult account, `sessionEpoch`, absolute 30-day reauth limit, inactive window, family ID, slot, generation and HMAC. One transactional CAS both rotates the successor and creates the new access record. No grace, replay receipts or consumed-token reuse.
- `/logout` (existing) revokes a P01-3 family for authenticated calls; signed `/device/logout` can revoke after access expiry; both provide local-only semantics.
- Android native `MethodChannel` uses a non-exportable P-256 Android Keystore signing private key and Keystore AES-256-GCM protected record in private preferences. Device key never serialized. Manifest disables backup.
- Production Flutter entry uses a state-driven authentication gate: restoring / offline Retry / signed-in account / sign-in, plus five-device management. Existing `UluvApp` diagnostics behavior remains available for P00/P01 tests by default.
- Flutter single-flight coalesces refresh calls; encrypted latest token is saved before exposing authenticated state; local logout intent is persisted before remote revoke, pending remote logout is retried on a later app start. No routine OTP or biometric prompts.
- On a lost successful refresh response, the old refresh token remains consumed. A later authoritative invalid-token response requires an interactive login, exactly as approved.

## Verification evidence available in this authoring environment

| Gate | Result |
|---|---|
| `npm run test:unit` | PASS: 25 tests including three new P01-3 proof/purpose/boundary tests |
| `npm run verify:p01-2:portable` | PASS: previously accepted portable regression coverage |
| `npm run test:p01-3:contracts` | PASS: source/Android storage/route guard (NOT a live backend test) |
| `npm run verify:p01-3:portable` | PASS |
| Node/TypeScript syntax checks | PASS for new and modified TS files |
| Secret, docs and cloud guards | PASS |
| Semantic `npm run typecheck` | **UNVERIFIED** here: project dependencies are not locally installed |
| Java DynamoDB Local / Fastify integration | **UNVERIFIED** here: owner Windows environment needed |
| Flutter analyzer, widget tests | **UNVERIFIED** here: Flutter SDK unavailable |
| Native Kotlin compilation / Android Keystore | **UNVERIFIED** here: Android SDK/physical device needed |
| Real device process kill + reboot + 30-day/backup behavior | **UNVERIFIED**, explicit owner manual gate |

**Never treat this source delivery as an authorized deployment or a P01-3 completion certificate.**

## Security/operational follow-ups before production

- Current local-only code purpose-derives distinct v1 access/refresh HMAC keys with HKDF from existing owner-configured local development root. Do not deploy that root, `.env`, or embedded Flutter local dev token. Production has a separately authorized later phase for independent KMS-backed secrets, TLS, formal key rotation and provider integration.
- Android signed proof and AES-GCM are device protection mechanisms, not a claim that every supported device has hardware-backed StrongBox or a completed external penetration test.
- The atomic database transaction prevents dual consumption. Lost-response recovery deliberately does not exist. Network failures keep sealed credential and show Retry; server-authenticated invalid credentials request re-login.
- Test fixtures must use only synthetic local identities. Device E2E refuses to overwrite pre-existing protected auth storage. Never reset real user's app data without explicit consent.
- Before release, verify secure-storage write failures, an in-flight refresh/logout race, backup/data transfer, stolen-token replay with another Keystore key, exact 30-day boundary, and password-change/reset session-epoch revocation on actual devices.
