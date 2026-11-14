# 2026-11-14 — P01-3 architecture review evidence record

**Nature:** documentation-only design audit. **Runtime/source modifications:** NONE. **Implementation status:** NOT STARTED. **Owner baseline:** P01-2 latest automated and manual acceptance confirmed in chat; P01-1 Android OTP automation remains a documented failed dev-only exception.

## Inspected real source (available local project snapshot)

- `apps/api/src/features/auth/policy.ts`: 86,400s legacy session lifetime.
- `apps/api/src/features/auth/routes.ts`: `requireSession` reads keyed-HMAC access session, verifies expiration and user epoch/status; `/logout` deletes token record only; OTP and signup transact session creation.
- `apps/api/src/features/auth/password.ts`: password login session factory; change/reset advance global epoch; no renewal/device family.
- `apps/flutter_app/lib/features/auth/auth_service.dart`: token/UID in result; no renew method, no persisted credential.
- `apps/flutter_app/lib/features/auth/auth_screen.dart`: memory-only token, explicit account/back handling.
- `apps/flutter_app/lib/main.dart`: P00 diagnostics startup with push to P01 auth.
- `apps/flutter_app/pubspec.yaml`: no secure storage dependency; `android/app/src/main/AndroidManifest.xml` has no explicit backup exclusion.
- `docs/architecture/02_PHYSICAL_SCHEMA.md`, `docs/design_reviews/P01_3_30_DAY_PERSISTENT_SESSION_DETAILED_SPEC.md`, P01 decision and QA guides.

## Current standards comparison (external; not source-implemented)

- NIST 800-63B-4 session reauth and persistent bearer-session cautions: https://pages.nist.gov/800-63-4/sp800-63b/session/
- NIST AAL1 30d recommended overall timeout: https://pages.nist.gov/800-63-4/sp800-63b/aal/
- RFC 9700 refresh rotation/sender constraints: https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14
- OWASP mobile secure sessions and reauth: https://cheatsheetseries.owasp.org/cheatsheets/Mobile_Application_Security_Cheat_Sheet.html
- Flutter secure storage version/backup warning: https://pub.dev/packages/flutter_secure_storage

## Result

Created new P01-3 master review, API/DynamoDB protocol, Flutter lifecycle, edge cases, automated verification, decisions/threat register and readiness runbook. This confirms **design documentation exists**, not that session persistence is ready. No app/backend/Android change, Node/Flutter/live DB test, package installation, secret inspection or cloud invocation performed as part of this design request.

## Exit criteria to start coding

Owner reviews and approves D13 decisions, especially 30-day reauth semantics, device proof, refresh lost-response behavior, offline logout and storage backup. Coding task must then implement runtime and tests in controlled slices with real-device coverage. **P02 remains not started.**
