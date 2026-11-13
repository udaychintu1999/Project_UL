# Owner-only environment and secrets handling

## Scope and boundaries
- Developers/AI inspect `apps/api/.env.example` only. The owner copies it privately to `.env` and fills personal local token/config; assistants must **not** read, print, ask for, or package this file. Existence-only checks are permitted; actual contents are not.
- Owner-managed AWS SSO/short-lived roles, CloudFront signing private keys, Google OAuth/service credentials, Apple StoreKit/Play payment credentials, and payment gateway keys belong **outside the repository and outside AI-accessible filesystems** (ideally dedicated secrets-management/service identities). Never put private keys in `.env`, markdown, fixtures, tickets or chat. `key ID` may be referenced without private signing material.
- `AWS_ACCESS_KEY_ID=local` and `AWS_SECRET_ACCESS_KEY=local` in the example are inert dummy strings used only against loopback DynamoDB Local. No real AWS credential should be supplied to local API/test processes.
- The backend must redact request `Authorization`, cookies, `x-uluv-dev-key`, signed URL query strings, email OTP values, session IDs and secret error causes from telemetry. Do not log entire request headers, AWS SDK exceptions with URL details or raw media response objects.
- Flutter holds only short-lived, authorized signed media URLs in volatile state, refreshes on expiry, avoids logging and persistent storage. It never holds AWS access keys or CloudFront private keys.
- Signed URLs should use HTTPS only, have minimal TTL and per-parent permission checks. S3 presigned PUT is reusable until expiry; use unique object keys and size/type/checksum validation plus one completion operation.

## Packaging policy
- Ignore `.env`, `.env.*` except `.env.example`, `.aws`, `*.pem`, `*.p8`, `*.p12`, `*.key`, `*.jks`, `*.keystore`, `*.kdbx`, credentials files, `google-services.json`, `GoogleService-Info.plist`, `.local`, `node_modules`, `.dart_tool`, customer media and downloaded files.
- Run `npm run test:secrets`; run package-safe script and validate ZIP contents. If suspicious files are present, abort. **Do not paste results with secret values**; scanners only report paths and category.
- If a secret was committed/exposed, treat it as compromised: inform owner; revoke/rotate with owner-controlled procedure, remove from history if appropriate; never republish in the issue details.

## Manual setup rule
The human operator creates and configures the real secret files/roles, verifies account/region privately and keeps credentials undisclosed to AI. AI produces only placeholder files and instructions. Do not request real credentials as part of troubleshooting.
