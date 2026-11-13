# API feature modules

Add `accounts/`, `profiles/`, `dating/`, `wallet/`, `friendship/`, `chat/`, `local/`, `media/`, `moderation/`, `notifications/` as their phase is built. Start with `routes.ts`, `service.ts`, `repository.ts`, `schema.ts` only when needed. Keep real DynamoDB Local read/write and authorization in services; no cloud calls in test mode. Do not create empty architecture layers or pretend features are implemented.
