# Authoritative environment/integration policy — FINAL v2.0

This document supersedes v1.0–v1.3 proposed environment statements and any conflicting archived handoff text. **No AWS operation is implicitly authorized.** See `docs/security/00_NON_NEGOTIABLE_GUARDS.md`.

| Phase | Database | Media | Payment & infrastructure |
|---|---|---|---|
| P00 | Java 17+ DynamoDB Local on loopback; no Docker | Local adapter; owner may **manually** prepare two dev buckets + one dev CloudFront distribution | Zero AWS access by agent or script; no credentials shared |
| P01–P03 | Java DynamoDB Local | Full profile/media API and local adapter. P02 can optionally test real DEV S3/CloudFront **only after fresh owner-approved scoped action** | No production services or paid tools |
| P04–P09 | Java DynamoDB Local | Local adapter and authorized DEV signed chat/profile flow (P05), never automatic fixture uploads | Deterministic local ledger, no live charge |
| P10–P15 | Java DynamoDB Local | Local Feed/Activities/chat local testing; owner-approved limited DEV real media validation if asked | No real AWS DynamoDB, no live payments |
| P16 | Java DynamoDB Local | Audit 2-bucket media design and IaC for separate production environment; DEV media still permission-gated | Google Play Billing sandbox/eligible alternate gateway decision; no live customer payment |
| P17 | Real **AWS** 18-table staging/production provisioning **only after distinct owner approval**, verify before release | Separate production persistent/temp buckets and CloudFront, security & deletion tests with fresh approval | ECS/SES/production media/payment go-live and release security with additional owner authorization |

## Media deployment topology
- DEV: Owner sets up **TWO private S3 buckets** (`MEDIA_PERSISTENT_BUCKET_DEV`, `MEDIA_TEMPORARY_BUCKET_DEV`) and **ONE CloudFront distribution with two S3 REST origins and two signed-URL-required path behaviors**, OAC, trusted key group, private key stored only in owner-controlled secrets management.
- Production P17: separate 2 private buckets and 1 separate CloudFront distribution. Never mix DEV and production account/bucket/path keys or credentials.
- Default everywhere before explicit runtime enablement: `MEDIA_STORAGE_DRIVER=local`. Do not auto-enable AWS based on the presence of environment variables, an AWS profile, or resource existence. Real AWS requests, including read-only tests, require fresh scoped approval. Ordinary deployed app uploads only once production runtime is owner-approved and operated under least-privilege service role; **agent/test automation never inherits this authority**.
- Backend implements `POST /v1/media/uploads` (S3 presigned PUT), finalize/HEAD checks, `GET /v1/media/{id}/access` (CloudFront signed GET). Authorized response pages include temporary signed thumbnail URLs; Flutter refreshes expired ones. Never store URL tokens as durable state.
- Time-limited URLs may remain usable until expiry after block/delete; application stops signing new URLs immediately and removes media with cleanup. S3 Lifecycle is asynchronous.

## Cloud approval and secret safety
- The owner—not the agent—creates resources and keeps credentials in private storage. Agents may author proposed console steps/IaC and synthetic tests, **not execute AWS commands** without separate, narrowly scoped owner consent. Even a cost-free action that accesses AWS needs approval.
- Explicit approval requires actor, target AWS account/environment, exact operation, bucket/prefix/object count+maximum total size, max cost estimate and cleanup; no blanket consent. Do not infer from 'continue', prior approvals, or .env existence. Never automate an approval prompt or bypass with `--yes`.
- No agent opens actual `.env`, `.aws/credentials`, private key, tokens, mobile signing keys or customer files; no secret values in artifacts, logs, telemetry, screenshots, or AI context. Run `npm run test:secrets` and `npm run test:cloud-guards` and package with safe script.
- API test and local DB scripts MUST use `127.0.0.1`/`localhost` only. AWS SDK initialization must fail closed in local mode. Production deployments are an independent owner-controlled release gate.

## Payment schedule
P00–P15 synthetic credit ledger, charged/refunded atomically through local DynamoDB. P16 real **test/sandbox** provider integration after approval; Google Play Billing is the default Android store path, eligibility of alternative billing/gateway in India rechecked during P16. iOS StoreKit later. No agent or Chat attempts a real purchase, payout, refund, account change, or charge without explicit owner approval.

This policy preserves U_Day-style phase-scoped D1–D3/T1–T3 development and does not make Dev AWS setup a P00 test gate.
