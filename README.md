> **Current P01-2 implementation update (2026-11-13):** The owner subsequently authorized proceeding after the design review. Source now splits signup from existing-user OTP login and adopts the new NIST password rules; the authoring portable suite passes, but Windows/Flutter/real database/Android acceptance remains **UNVERIFIED**. P01-3 implementation remains held. See `docs/qa/P01_2_INTENT_AND_NIST_IMPLEMENTATION_2026_11_13.md`. The earlier design-freeze notes below are historical and no longer describe the current source.

> **P01-2/P01-3 design freeze (2026-11-13):** Analysis/documentation only. Owner approved NEW NIST password rules (15 Unicode code points, no mandatory symbol); current code/tests still enforce 8+symbol. Source behavior has NOT been updated. See `docs/design_reviews/P01_2_P01_3_DESIGN_AUDIT_READ_FIRST.md` and `docs/design_reviews/P01_NIST_PASSWORD_POLICY_DECISION_2026_11_13.md`. Known P01-2 issues: Email code login incorrectly requires DOB/consent and Android recovery Reset tap did not hit button. Do not mark P01-2 complete or start P01-3 implementation.

# U_luv — Full Developer Handoff v2.0 FINAL

**U_luv — Algorithm-Free Connections.** Complete product, architecture, 18-phase delivery plan (P00–P17), 18 DynamoDB tables, 3 development + 3 testing sections each phase, Fastify/TypeScript and Flutter P00 starter, secure-media architecture, mandatory AI safety gates, and real automation/manual QA instructions.

**Begin:** [docs/START_HERE.md](docs/START_HERE.md) · **Mandatory secrets/cost rules:** [docs/security/00_NON_NEGOTIABLE_GUARDS.md](docs/security/00_NON_NEGOTIABLE_GUARDS.md) · **AI agent rules:** [AGENTS.md](AGENTS.md).

## Owner-approved schedule

| When | Database | Media | External/paid services |
|---|---|---|---|
| P00–P15 | Java 17+ DynamoDB Local JAR, **never AWS DynamoDB** | Owner manually sets up **two DEV private S3 buckets + one DEV CloudFront distribution** early; code defaults to local-media adapter. Development cloud requests only after distinct explicit scoped owner approval. | No payments, no SES/cloud deployment or external paid-test automation. |
| P16 | Still Java DynamoDB Local | Security review/production IaC drafting; optional dev media tests only with distinct approval | Official Google Play Billing sandbox; eligible Indian gateway decision, zero production/live charges. |
| P17 | Owner authorizes real 18 DynamoDB AWS tables in staging/production, then tests | Separate prod persistent/temp buckets and CloudFront + ECS + controlled integration | Final payment provider and approved go-live release checks. |

An AWS bucket's existence **is NOT permission** for scripts/agents to upload or read. AWS cost/write activities are denied by default. **AI agents are not allowed to read actual `.env`, AWS profiles or secrets.** Manual owner setup is documented in `docs/manual/OWNER_DEV_S3_CLOUDFRONT_SETUP.md` and exact authorization in `docs/security/02_CLOUD_ACTION_APPROVAL.md`.

**New all-phase QA rule:** When automated testing repeatedly fails or cannot test a physical device/interactive user flow, AI must proactively ask the owner for a specific manual test. Preserve automated FAIL versus manually observed PASS; do not waive security or release gates. See [manual verification escalation](docs/qa/MANUAL_VERIFICATION_ESCALATION.md).

## Current implementation — P01 local email OTP slice (2026-11-13)

P00 remains owner-confirmed `CORE_FLOW_VERIFIED`. The owner explicitly authorized P01; its first local-development slice now includes Fastify/DynamoDB Local OTP challenges, DOB/consent and immutable account creation, local outbox, revocable session, and a connected Flutter UI. **P01 is `PARTIALLY_VERIFIED` only**: the owner ran passing real Java DB/API integration and Flutter analyzer/widget checks, and TypeScript is now passing; the USB Android E2E test remains FAILING despite several targeted corrections, while the owner manually confirmed account access and logout; **no real email was sent** and Google/server-verified identity, refresh/storage and complete eligibility admin flows are still outside the delivered slice. Do not advance to P02. Windows commands: [P01 manual runbook](docs/manual/P01_EMAIL_OTP_WINDOWS_TEST.md) · implementation and evidence: [P01 slice report](docs/qa/P01_EMAIL_OTP_LOCAL_SLICE_2026_11_13.md).

## Local quickstart — standardized npm commands (Windows PowerShell or cmd)

**Owner manually starts/stops the official Java DynamoDB Local process every session** (no Docker, and npm does not start Java). See [manual database startup](docs/manual/JAVA_DYNAMODB_LOCAL_SETUP.md) and the [complete P00 Windows runbook](docs/manual/LOCAL_START_AND_VERIFY.md).

From project root, **once** after installing Node 22+, Java 17+, Flutter/Android SDK:

```powershell
npm install
npm run env:init          # OWNER-ONLY, once; privately creates apps/api/.env from .env.example and random token
npm run flutter:setup     # first-time Android native scaffold + Flutter dependencies
```

For each development session, start DynamoDB Local yourself and leave its Java terminal open. In a **second project-root terminal**, run:

```powershell
npm run db:provision     # creates/verifies 18 LOCAL tables after Java startup
npm run dev:api          # starts Fastify, leave running
```

In a **third terminal**, run `npm run dev:flutter` for a USB-connected Android phone (**default**); the launcher runs `adb reverse tcp:3000 tcp:3000` automatically. To switch between USB and emulator, edit **`apps/flutter_app/dev_connection.config.mjs`** (commented, non-secret config) or run `npm run dev:flutter -- --target emulator`. USB uses `127.0.0.1:3000` with adb reverse; emulator uses `10.0.2.2:3000`. No Wi-Fi/LAN IP or public Fastify binding is needed. Verify `adb devices` first. Keep `npm run dev:api` running in another terminal; `npm run test:integration` fails with ECONNREFUSED if Fastify is stopped.

In a **fourth terminal**, run `npm run verify:p00:portable` for source-only/portable tests, or **`npm run verify:p00` for the full automated gate** (real Java DB + Fastify API + Flutter Android device/emulator required). Individual steps: `npm run typecheck`, `npm run test:db`, `npm run test:integration`, `npm run test:flutter`, `npm run test:flutter:e2e`. Owner confirmed outage/restart recovery on 2026-11-13; additional rapid-tap and explicit HTTP status checks remain optional P00 QA.

`apps/api/.env` **is needed**, but the owner-only `npm run env:init` creates it automatically. The example values point only to localhost and dummy AWS SDK credentials; the random P00 token is **private** and never included in ZIPs. Never share `.env` or ship the diagnostic Flutter build (it contains the local debug token). If `.env` already exists, `env:init` now exits successfully without reading, replacing, or displaying it. Run once for a new checkout; it is safe to skip on subsequent sessions.

Signed URL API contracts: read [docs/architecture/12_S3_CLOUDFRONT_SIGNED_URLS.md](docs/architecture/12_S3_CLOUDFRONT_SIGNED_URLS.md); bucket topology: [docs/architecture/13_TWO_BUCKET_MEDIA_ARCHITECTURE.md](docs/architecture/13_TWO_BUCKET_MEDIA_ARCHITECTURE.md); simple code layout: [docs/architecture/14_FEATURE_MODULE_STRUCTURE.md](docs/architecture/14_FEATURE_MODULE_STRUCTURE.md).

**Verified status (2026-11-13): P00 CORE_FLOW_VERIFIED.** Owner-provided Windows logs confirm the **full automated P00 gate PASSED** with real Java DynamoDB Local, Fastify, and physical USB Android; the owner confirmed both buttons worked and the app displayed a database-unavailable error during a local DB outage, returning to normal after restart. This is a verified P00 foundation, **not a completed application or deployed AWS environment**. **That statement was the historical P00 closeout state; P01 is now authorized and `PARTIALLY_VERIFIED`.** The owner accepted pausing the failing P01 automated USB E2E while continuing within P01; P02 remains not started. See [P00 closeout](docs/qa/P00_CLOSEOUT_2026_11_13.md) and [current progress](docs/implementation/PROGRESS.md).

## P01-2 password implementation (local only)
P01-2 adds email/password sign-in and recovery while retaining OTP; 30-day login persistence is a distinct P01-3 slice. Start with `docs/implementation/P01_PASSWORD_AND_SESSION_PHASE_SPLIT.md` and the Windows test commands in `docs/manual/P01_2_PASSWORD_WINDOWS_TEST.md`. Argon2 dependency requires owner `npm install` once because no registry resolution was possible in the authoring environment. Do not claim P01-2 is fully verified until Windows/device tests pass.

## P01-2: automated Android password acceptance (2026-11-13)

`npm run verify:p01-2` now requires a distinct P01-2 device E2E test, not just the P00 diagnostics buttons. Run all feasible automated checks before asking the owner for manual acceptance. See `docs/manual/P01_2_PASSWORD_WINDOWS_TEST.md` and `docs/qa/P01_2_AUTOMATION_FIRST_ANDROID_2026_11_13.md`. The P01-1 OTP Android automation failure remains separately documented and is **not** treated as PASS. P01-3 persistent login has not started.

**P01-2 UI note (2026-11-13):** Sign up, password login, authenticated account home and password settings are separate views. New signup presents only Create/Confirm after OTP; normal password login displays no password-editor fields. See `docs/qa/P01_2_SIGNUP_LOGIN_UX_REPAIR_2026_11_13.md`.
