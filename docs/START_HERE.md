# CURRENT PROJECT CHECKPOINT — 2026-11-14 (P01-3 V3)

**P00:** historical owner `CORE_FLOW_VERIFIED`. **P01-1:** manual core accepted, Android OTP automated FAIL accepted only for local development (not a PASS). **P01-2:** owner explicitly reported all latest automated and manual checks PASS, accepted. **P01-3:** design and security decisions APPROVED, **NO CODE YET**; owner requested complete docs before authorizing coding. **P02:** not started.

**Current P01-3 authority:** `docs/design_reviews/P01_3_APPROVED_IMPLEMENTATION_CONTRACT_2026_11_14.md` and companion simple-refresh/device/UX/QA docs. V2 proposals and archived `PENDING` markers are historical, not present directions. No AWS, live email, Google, or payment authorization.

---

> **2026-11-14 P01-2 implementation update:** Shared atomic five-email rolling-24h backend budget, privacy-neutral no-send, Flutter inline validation and authenticated Back guard implemented in source. Authoring portable suite PASS; full TypeScript/real DynamoDB/Flutter/Android acceptance **UNVERIFIED** here. Owner must run new `npm run test:p01:email-budget:integration` and full P01-2 automation before manual QA. P01-3 30-day persistence not started. See `docs/qa/P01_2_EMAIL_BUDGET_UX_IMPLEMENTATION_2026_11_14.md`. Earlier phase-status statements are historical.

> **Current P01-2 implementation update (2026-11-13):** The owner subsequently authorized proceeding after the design review. Source now splits signup from existing-user OTP login and adopts the new NIST password rules; the authoring portable suite passes, but Windows/Flutter/real database/Android acceptance remains **UNVERIFIED**. P01-3 implementation remains held. See `docs/qa/P01_2_INTENT_AND_NIST_IMPLEMENTATION_2026_11_13.md`. The earlier design-freeze notes below are historical and no longer describe the current source.

**New mandatory cross-phase QA rule (2026-11-13):** If automation repeatedly fails or cannot exercise a device/interactive workflow, the AI must **proactively request a concrete owner-run manual test**, with commands, expected observations, and secure evidence collection. Do not keep issuing speculative patches. Track manual PASS separately from automated FAIL; an owner-accepted local-development exception never bypasses mandatory security or production release gates. Read `docs/qa/MANUAL_VERIFICATION_ESCALATION.md`. Latest P01 automated USB E2E still **FAILED** after the test-harness patch; the owner manually confirmed account-access and logout PASS, and accepted pausing this E2E investigation. Overall P01 `PARTIALLY_VERIFIED`; P02 not started.
**P01 Android manual/e2e note (2026-11-13):** Owner has now observed successful `Check account access` and `Log out` in the manually launched Android app. The latest automated P01 E2E still failed with a truncated HTTP response and failed GET/POST probes before this update. Current test-only harness patch starts each real API call in Flutter's real async testing zone; **physical Android after this patch is UNVERIFIED**. Read `docs/qa/P01_ANDROID_E2E_HARNESS_2026_11_13.md`. P00 historical `CORE_FLOW_VERIFIED`; P01 `PARTIALLY_VERIFIED`; do not start P02.

# START HERE — U_luv FINAL handoff v2.0

**Current P01-2 addendum (2026-11-13):** Email+password integration source previously added; **new approved NIST password policy replaces 8+symbol** (15 Unicode code points, no character-class requirement); current source not yet changed; see `docs/implementation/P01_PASSWORD_AND_SESSION_PHASE_SPLIT.md`. P01-3 will implement 30-day persistent sessions; it is NOT P02. P01-2 remains `PARTIALLY_VERIFIED`: owner previously installed dependencies and passed local password API/Flutter checks, but Android recovery E2E still failed at a non-hittable button and the new password-policy contract is not yet implemented. Prior P01-1 automated Android OTP failure remains documented separately. Do not infer release approval.


Read `AGENTS.md` and `docs/security/00_NON_NEGOTIABLE_GUARDS.md` **before inspecting repository configuration or using tools**. These are mandatory for AI Chats and autonomous coding agents. Do not inspect actual `.env`, profiles, keys or customer data. Sharing this ZIP grants no AWS permission.

## Small-step reading order
1. `AGENTS.md` and this file.
2. `docs/security/00_NON_NEGOTIABLE_GUARDS.md`; `docs/implementation/ENVIRONMENT_AND_INTEGRATION_POLICY.md`.
3. `docs/product/PRODUCT_CONTRACT.md`, `docs/implementation/PHASE_MASTER.md`.
4. `docs/implementation/PROGRESS.md`, `docs/NEXT_STEP.md`, and current `docs/implementation/phases/Pxx.md`.
5. `docs/handoff/INITIAL_PROMPT_UNIVERSAL.md` or `CONTINUE_PHASE_PROMPT_UNIVERSAL.md`; only relevant architecture/QA docs.

**Schedule:** P00–P16 Java DynamoDB Local, no AWS DynamoDB. Owner manually creates two DEV private S3 buckets (persistent/temporary) and one DEV CloudFront distribution in early phases; all automated tests use local/fake media by default. No AWS reads/writes by agents or scripts without narrowly scoped, explicit per-action owner approval. Initial DEV resource setup does not authorize uploads. P16 payment sandbox + production planning; P17 separate real AWS DynamoDB/media/ECS production integration with explicit approval. iOS StoreKit later.

**Media:** S3 presigned upload PUT, verified completion, CloudFront signed GET from backend after authorization, signed URLs included only for allowed visible images in profile/liked-you/feed/chat response pages; never log/store signed bearer URLs. Read `docs/architecture/12_S3_CLOUDFRONT_SIGNED_URLS.md`, `13_TWO_BUCKET_MEDIA_ARCHITECTURE.md`.

**Code layout:** Feature modules for BE and Flutter, see `docs/architecture/14_FEATURE_MODULE_STRUCTURE.md`. Do not rebuild P00 scaffolding or invent a microservice architecture.

**Local developer commands:** Run `npm install`, owner-only `npm run env:init` once, **start Java DynamoDB Local manually**, then `npm run db:provision`, `npm run dev:api`, `npm run flutter:setup` (once), `npm run dev:flutter`. `npm run verify:p00` is now the real API/DB/Flutter automated gate; `npm run verify:p00:portable` is offline-only. Complete runbook: `docs/manual/LOCAL_START_AND_VERIFY.md`. Never share the owner-generated `.env`.

**Current engineering task (2026-11-13):** P00 is owner-confirmed `CORE_FLOW_VERIFIED` and P01 is explicitly authorized. The first P01 local-development email OTP/age-eligibility slice is `PARTIALLY_VERIFIED`: owner TypeScript, real Fastify/Java DB integration, and Flutter analyzer/14 widget tests passed. The P01 Android automated E2E still fails with truncated OTP HTTP response headers after test-harness changes, while owner-run interactive account access/logout succeeded. Automated root cause remains unresolved and is explicitly accepted as a local-development exception only. Google identity-provider validation, session restore and full eligibility operations remain pending. Read `docs/NEXT_STEP.md` and `docs/manual/P01_EMAIL_OTP_WINDOWS_TEST.md`. No P02/cloud/payment work. Every development slice produces changed files plus updated `docs/` ZIP, scanned for secrets.
