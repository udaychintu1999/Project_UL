# API feature modules

The existing `auth/` module covers P01-1 email OTP, P01-2 password and shared email quota, and P01-3 device-bound persistent sessions. The owner has accepted these phases for local development; this module does **not** implement real SMTP/Google, public cloud production authentication, or other later phase features.

- `routes.ts`: explicit email signup/login intent, OTP verification, authorization and account endpoints.
- `password.ts`, `password-policy.ts`: credential lifecycle, legacy compatibility and current password policy.
- `email-budget.ts`, `email-budget-policy.ts`, `policy.ts`: server-authoritative budget, OTP and validation helpers.
- `device-sessions.ts`, `device-session-policy.ts`: signed device-session enrollment, single-use refresh, listing and revocation.

Future phases may add `accounts/`, `profiles/`, `dating/`, `wallet/`, `friendship/`, `chat/`, `local/`, `media/`, `moderation/` and `notifications/` as required. Introduce a `routes.ts`, `service.ts`, `repository.ts` or `schema.ts` layer **only when useful for real behavior**. Do not create empty modules, stub features, or change the accepted table model solely for folder aesthetics.

Refer to `../../docs/MODULE_AND_ROUTE_MAP.md` and `../../docs/READABILITY_AND_MAINTAINABILITY_GUIDE.md` before editing auth flows. Preserve real DynamoDB Local reads/writes, session/security checks and local-only guards.
