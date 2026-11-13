# Cloud/payment actions — explicit owner authorization protocol

**Zero automatic AWS traffic, zero uploads by default.** A shared codebase, general request to implement AWS, a bucket's existence or previous authorization DOES NOT permit any new operation. Even read-only live AWS checks need permission. No generic `--yes`, env flag, `CI=true` or runtime approval-file mechanism grants a standing exception.

## First produce a human-readable request
Agent/Chat must describe the proposed operation *before running it*:

```
REQUEST FOR ONE CLOUD ACTION (NOT AN AUTHORIZATION)
Actor: [owner manually / named authorized agent]
Environment & AWS account alias: [DEV only; no credentials/account numbers]
Service and exact API action: [e.g. S3 PutObject]
Target: [one dev bucket + exact temporary test prefix]
Test data: [synthetic only]
Hard upper bound: [1 object, <= 100 KiB, no replication/batch]
Estimated billing exposure: [read/write/egress implications, small test only]
When it may occur: [single approved session, no automatic retry]
Cleanup method and responsible operator: [manual delete and verify]
Evidence to collect: [redacted pass/fail; never URL/signature]
Fallback if not approved: [local mock / manual test and UNVERIFIED]
```

The conservative values are **illustrative per-test ceilings, not preapproval**. Only an explicit affirmative owner response for the particular bounded action permits proceeding; absent/ambiguous permission = STOP, ask owner to execute manually instead. Never repurpose a staging approval for production. An approval for creating a resource is not approval for uploading or deleting objects. Record only non-secret decision metadata in `docs/qa/EVIDENCE_LOG.md`.

## Dangerous operations requiring separate approval
- S3 any operation: listing, HEAD, presign+consume, PUT/GET/DELETE, lifecycle updates and direct CLI requests.
- CloudFront any distribution updates, invalidations, request testing or signing-key/key-group operations.
- IAM role/policy creation, Secrets Manager or Parameter Store reads, KMS decrypt, SES email sending.
- Cloud deployment or real DynamoDB table reads/writes/provisioning, AWS CLI/IaC apply, any external provider billable operation.
- Real Google Play/Apple/third-party charges, refunds, settlement, subscriptions, publication and store credentials.

## How to enforce beyond prompts
The owner does **not** expose AWS credentials to AI tool environments; attach an explicit deny-all IAM policy to any default agent identity where feasible, and create a separate narrowly scoped owner/runtime role when approved. Local scripts fail closed to loopback. Code review must reject any script that silently initiates AWS calls or has a `--yes` bypass. Shell scripts/dry-run should never reach AWS.

AI Chat without tools: generate complete code, offline synthetic unit tests and step-by-step owner-runbook, mark live cloud checks UNVERIFIED. Coding agent with tools: exactly same prohibition unless distinct explicit permission exists, and even then avoid reading secrets.
