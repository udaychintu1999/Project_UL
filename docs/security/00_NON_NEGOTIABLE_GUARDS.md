# STOP — Non-negotiable security and cloud-cost guards (FINAL)

**Priority:** This file, root `AGENTS.md`, and `docs/implementation/ENVIRONMENT_AND_INTEGRATION_POLICY.md` override older versioned/proposal text. An AI agent or regular AI Chat has **NO permission to use real AWS or view secrets** merely because the user shared the project, AWS names, or a prompt requesting software development.

## 1. Environment files, credentials and secrets — RED ZONE

**Absolutely forbidden for AI/automation:**
- Reading, searching, printing, uploading, pasting, modifying, archiving, committing, comparing, or summarizing any real `.env`, `.env.*` except files whose names end `.example`; `.aws/credentials`, `.aws/config`, cloud key files; CloudFront PEM private keys; StoreKit/Play/payment gateway credentials; OAuth secrets; SES credentials; JWT/signing private keys; mobile app signing keystores; private media or real user records.
- Tools such as `cat`, `Get-Content`, grep, editor previews, environment dumps (`set`, `env`, `Get-ChildItem Env:`), `aws configure list`, debugger snapshots, memory dumps or stack traces that expose these secrets. Do not use `aws sts get-caller-identity` automatically either: **all real AWS calls require approval**.
- Accepting secrets pasted into chat as routine workflow. Ask the owner to configure on their own workstation through a secure mechanism; use placeholders. No real secrets in documents, test results, logs, screenshots, ZIPs, Git history or telemetry.
- Treat **S3 presigned upload/download URLs, CloudFront signed URLs, password-reset and OTP links** as bearer secrets: do not log query strings, serialize to error reports, or put them in screenshots/test fixtures. Only return URLs through authenticated application APIs to authorized viewers.

Allowed: read `.env.example` (known fake placeholders), check `Test-Path`/file-exists for actual .env without reading contents; accept non-sensitive operational parameters such as `MEDIA_STORAGE_DRIVER=local` from documented safe files. If actual secrets unexpectedly leak, avoid repeating, stop and advise owner to revoke/rotate.

## 2. Deny AWS actions by default

For AI tools, agent-run scripts and test automation, **AWS operations are prohibited until per-operation owner authorization**: S3 GET/HEAD/LIST/PUT/DELETE/copy, CloudFront requests/invalidation, resource creation/changes/deletion, IAM/Secrets Manager access, SES sends, DynamoDB AWS calls, AWS billable API activity, external payment/store calls, live charges/refunds, CI/CD deployment and account operations.

- Founder manually creates **two dev private S3 buckets and one dev CloudFront distribution** early. The act of creating them **does not grant testing or upload permission**.
- First response to a requested real AWS test: propose the **smallest** necessary operation, bounded resources/objects, cost and cleanup; ask owner to perform it or explicitly approve that single operation. If owner chooses manual, provide exact steps and no tool calls.
- Approval must be explicit in the *current action context*, limited and revocable. A previous 'approved architecture', `.env` file, CLI credentials or AWS resource existing is not authorization. **No script/flag can self-authorize**. An agent never runs IaC apply or cloud write on its own initiative.
- AI does not handle owner credentials. If owner grants a tool operational access, prefer a separate restrictive role, explicit deny policy, limited permissions, no prod access. The safest AI role is **no AWS permission**.
- Only after owner-approved production deployment may the actual user-facing backend service use constrained runtime AWS roles. This does not give agents/QA scripts the same permission.

## 3. Machine-enforced local-first gates

- All P00–P16 database tools require DynamoDB Local on a **loopback HTTP endpoint** and dummy credentials; fail immediately on missing/remote endpoints. `APP_ENV=local` cannot silently fall back to real AWS.
- `MEDIA_STORAGE_DRIVER=local` is default; AWS adapter is opt-in and separate from automated tests. Never automatically upload fixtures to AWS. Cloud tests are `UNVERIFIED` until specifically approved and actually executed.
- Run `npm run test:secrets` and `npm run test:cloud-guards` before packaging. `scripts/release/package-safe.py` refuses secret-bearing paths and common credential signatures. Redact risky values before logging. Do not bypass failures by weakening checks.

## 4. Phase gates and evidence

- P00–P15: Java DynamoDB Local and local media workflows; dev S3 availability is optional for testing, not a blocker. P16 payment sandbox (approval required) and production planning. P17 real AWS DynamoDB production tables, separate prod S3/CloudFront/ECS only with explicit owner authorization.
- All D1/D2/D3 and T1/T2/T3 sections apply. Record actual command, environment, result and redacted evidence. Any cloud check not actually performed is `UNVERIFIED`, not PASSED.
- Each step ZIP must include source/tests/scripts + `docs/` changes but no real `.env`, credentials, signed URLs, media, local DB, caches or build binaries. Scanners report **paths/issue codes**, never secret values.

See `01_ENV_AND_SECRETS_HANDLING.md`, `02_CLOUD_ACTION_APPROVAL.md`, `03_AWS_IAM_ISOLATION.md`, `docs/manual/OWNER_DEV_S3_CLOUDFRONT_SETUP.md`.
