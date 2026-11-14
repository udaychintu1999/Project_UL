> **Current P01-2 implementation update (2026-11-13):** The owner subsequently authorized proceeding after the design review. Source now splits signup from existing-user OTP login and adopts the new NIST password rules; the authoring portable suite passes, but Windows/Flutter/real database/Android acceptance remains **UNVERIFIED**. P01-3 implementation remains held. See `docs/qa/P01_2_INTENT_AND_NIST_IMPLEMENTATION_2026_11_13.md`. The earlier design-freeze notes below are historical and no longer describe the current source.

# P01-2 — Password policy change: NIST SP 800-63B-4 alignment

**Decision:** OWNER APPROVED on 2026-11-13. **Status:** DOCUMENTED / IMPLEMENTATION PENDING. This is a product requirement update, not evidence that deployed or local application behavior has changed.

## Binding replacement of the older password policy

The owner explicitly superseded the old **8-character minimum + mandatory special punctuation** rule. That former rule must not be implemented, taught, or verified as the target rule from this point onward. Preserve dated historical QA records as historical evidence rather than retroactively changing their original results.

| Dimension | New approved target | Specific implementation/verification |
|---|---|---|
| Minimum password length | **15 Unicode code points** for U_luv's single-factor email+password sign-in | Test 14 invalid, 15 valid, emoji/surrogates; count code points, not UTF-16 units or bytes |
| Character classes | **No mandatory uppercase, lowercase, digit, or special character** | Plain ASCII passphrases, punctuation-free phrases and spaces must work |
| Maximum | Support **at least 64 code points**; current implementation's 256-code-point/1024-byte cap needs review for reasonable Unicode use | Test 64, >64 when allowed, max+1 rejection and byte limit without silent truncation |
| Accepted input | Printing ASCII, spaces, Unicode; consider NFC normalization consistently on server before hashing and verification | Copy/paste, password managers, autofill; Unicode NFC equivalence and no accidental whitespace trimming |
| Weak secrets | Block commonly used, expected, or compromised whole-password values; context-specific terms where appropriate | Production-grade local blocklist or approved privacy-preserving breached-password check; tiny hardcoded denylist alone is insufficient for release |
| Storage | Salted adaptive hash using vetted Argon2id with migration metadata, tuned cost | Validate target hardware latency and concurrency; never log, echo, or store plaintext passwords |
| Rotation | No mandatory periodic password changes; force rotation when compromise evidence exists | Revocation and recovery after security events, no arbitrary 30/90-day password expiry |
| Recovery | No security questions, KBA or password hints | Purpose-bound one-time recovery, generic public response, replay defense |
| Rate limiting | Throttle failed authentication; guard email, account, IP/device dimensions without account-lockout abuse | Test distributed/repeated attempts and legitimate user recovery; do not create user enumeration |

**Source:** NIST SP 800-63B-4 (July 2025), §3.1.1.2: https://pages.nist.gov/800-63-4/sp800-63b/authenticators/#passwordver ; OWASP password storage: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html . These are references for design; this document does not assert U_luv has achieved NIST conformity.

## Implementation migration and existing accounts

- **Current code still conflicts**: `apps/api/src/features/auth/password-policy.ts` enforces `PASSWORD_MIN_LENGTH=8` and an ASCII punctuation regex; existing unit and source-contract tests also assert the legacy rule. No source changes were made in this documentation-only review.
- Apply the new policy coherently to registration, add-password, change-password, reset-password and Flutter validation; update tests and user-facing strings together in a **separately authorized implementation**.
- For already-created 8–14-character passwords, choose a safe migration policy before editing code. Recommended: permit existing valid hashes to sign in; prompt upgrade without arbitrary lockout; enforce the new minimum on future set/change/reset; define a supervised production cutover and policy for actually compromised passwords. Do **not** silently invalidate users or claim the legacy credentials now meet the new creation policy.
- Use the same Unicode normalization semantics for new password set and verification; older hashes may require a legacy-verify path until upgraded, or equivalent handling documented and tested. Preserve full input (no trimming/truncation).
- A no-symbol password of 15+ code points must pass the new length/strength check unless specifically blocked as compromised. An 8-character password with symbols must **not** be accepted for new credentials.

## Review gate

P01-2 cannot be marked complete until the implementation, backend tests, Android widget/E2E tests, and canonical documents all agree with this policy. Record the owner test output; do not label earlier 8-character tests as current-policy PASS.
