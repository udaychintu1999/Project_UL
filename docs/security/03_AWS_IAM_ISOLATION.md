# IAM isolation and real cost protection

**Best control: do not make AWS credentials available to AI agents or test scripts.** Prompt instructions and test scanners cannot enforce a restriction if an agent holds administrator credentials. The owner should run AWS setup from a separate trusted console/session.

- Default agent identity: **NO AWS permissions**. `docs/security/iam/deny_all_agent_aws.json` illustrates an explicit DENY policy when using a dedicated agent role. It overrides any accidental grants, but IAM attachment itself is an owner-only action.
- Actual Fastify production runtime identity (P17): scoped access only to its two environment-specific buckets/prefixes for approved operations and signing-key access to approved secret store; no S3 bucket-policy/admin privileges, no `iam:*`, no table-management privileges. CloudFront OAC gets restricted bucket-read permissions. Read-only config checks remain owner-controlled.
- Owner provisioning role: separate from runtime, never given to agents. Use short-lived SSO/session credentials rather than copying permanent access keys into `.env` or chat. Real billing alerts are owner-configured; thresholds are notifications, not hard spend ceilings.
- Use environment allowlisting: DEV two buckets and DEV CloudFront distribution only in early development, staging and PROD entirely separate. Never share content paths across environments. Keep DynamoDB always on loopback through P16.
- AWS Budgets and Cost Anomaly Detection can alert on spend, but won't prevent every charge. Restrictive IAM and no credentials are stronger gates. S3/CloudFront may incur charges even for limited accesses; limit approved fixture count and bytes.

## Media signing key isolation
- CloudFront uses public key + trusted key group; the backend signer uses the **private key** held in owner-managed secrets. No private PEM or value in ZIP, docs, `.env`, Flutter or agent-accessible files. Production secret retrieval belongs to an owner-deployed restricted service identity, not AI tool sessions.
- Do not log `Signature`, `Key-Pair-Id`, `Policy`, `X-Amz-Signature`, `X-Amz-Credential`, `X-Amz-Security-Token`, or other signed URL query strings.

See AWS documentation: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html , https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-overview.html .
