# START HERE — U_luv FINAL handoff v2.0

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

**First engineering task:** complete P00 end-to-end Flutter ↔ Fastify ↔ real Java DynamoDB Local, with local-only tests and zero AWS network operations. Fix defects and rerun. Record execution evidence; do not mark live tests PASSED from static review. Every development slice produces changed files plus updated `docs/` ZIP, scanned for secrets.
