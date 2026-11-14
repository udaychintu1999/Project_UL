# P01-2 — Email-budget and form-validation analysis evidence (2026-11-14)

**Documentation-only decision and risk audit — NO runtime change made.**

## Owner observations
- After login, Android Back reveals the P00 diagnostics buttons. P01-3 30-day persistence is not implemented and must not be implied.
- Signup with an already-used email could waste a verification email; the owner asks for more helpful errors without unnecessarily increasing API calls.
- Owner requests a limit of five or seven emails in 24 hours, proactive inline Flutter validation, and careful rate-limit analysis before coding.

## Findings in actual source
- Existing OTP issuance has 60-second cooldown and five-per-hour cap per email. Password recovery is separately metered. **No unified per-email rolling 24-hour cap.**
- OTP request doesn't inspect existing/unknown identity before challenge issuance. Recovery issues a challenge for unknown accounts.
- Signup and public responses must protect email existence; exposing an exact 'already registered' result would enable enumeration.
- Flutter performs some validation only after action (e.g., password length) and some fields currently have no reactive errorText.
- AuthScreen is pushed from the P00 diagnostics root, so Back reveals the P00 shell. Persisted login is reserved for P01-3.

## Decision proposal
- Five successful code issuances per **rolling 24 hours**, shared across signup/login/recovery, one minute between sends; atomic DynamoDB CAS transactions; idempotency; no plaintext email/code in budget keys or logs.
- Ineligible anonymous signup/login/recovery requests **must not send** but return a privacy-safe generic response. Authenticated users may receive specific account-status messages.
- Add frontend live field validation and screen-reader feedback, without weakening backend validation.
- Back from signed-in account must not expose diagnostics. Do not imply session persistence across restarts.
- Production provider requires separate delivery idempotency, source-IP/global caps, reconciliation, provider quota and timing/side-channel review.

## Verification status
- Inspected source and existing historical Windows evidence. No new production code or Android tests were executed in this analysis step.
- Historical owner evidence (2026-11-13): P01-2 full verifier and physical Android password E2E passed, while P01-1 automated OTP E2E retained its local-development exception.
- **24-hour quota, no-send eligibility, inline validations and authenticated Back behavior are NOT IMPLEMENTED / NOT VERIFIED.**
- Begin implementation only against `docs/design_reviews/P01_2_EMAIL_BUDGET_VALIDATION_NAVIGATION_SPEC.md`, using the staged test-first gate.
