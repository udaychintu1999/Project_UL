# API feature modules

Add `accounts/`, `profiles/`, `dating/`, `wallet/`, `friendship/`, `chat/`, `local/`, `media/`, `moderation/`, `notifications/` as their phase is built. Start with `routes.ts`, `service.ts`, `repository.ts`, `schema.ts` only when needed. Keep real DynamoDB Local read/write and authorization in services; no cloud calls in test mode. Do not create empty architecture layers or pretend features are implemented.

**P01 actual module:** `auth/` contains the local email-OTP policy and Fastify routes. No real SMTP/Google or production auth is claimed. Other feature folders are future phases.
