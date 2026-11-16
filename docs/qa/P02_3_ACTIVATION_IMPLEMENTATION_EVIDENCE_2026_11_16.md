# P02-3 — Independent Activation Intent, Privacy & Eligibility (2026-11-16)

## Source and user acceptance baseline

- **P02-2: OWNER_ACCEPTED (local development).** On 2026-11-16 the owner reported the final guided onboarding, Flutter compile repair and physical UI flow *working* and explicitly requested that P02-2 be marked complete. Prior owner logs showed portable verification, TypeScript, lint, real Fastify/DynamoDB Local photo integration and the UI-driven Android test through checkpoint 12; the owner subsequently reported the patched final test working. Do not manufacture missing raw PASS logs.
- The separately automated Android picker in tests is a **deterministic MethodChannel fixture**. A manual, native Android gallery/files chooser test has not been explicitly reported in the conversation; keep that evidence gap visible.
- **P02-3: SOURCE_IMPLEMENTED / PORTABLE_VERIFIED** pending owner's Windows `typecheck`, lint, Flutter widget, real Fastify/DynamoDB integration, physical Android E2E and manual acceptance. P02-3 is *not* owner accepted on ZIP creation.

## Implementation in source

1. `apps/api/src/features/profiles/activation-policy.ts`: owner-profile eligibility based on saved public handle, shared name, selected mode, declared gender, broad locality, valid draft fields, owner-READY mode-assigned images and derived age. A versioned snapshot of account handle and shared setup revisions protects against stale activation after edits.
2. `routes.ts`: authenticated `POST /v1/profiles/me/:mode/activate` and `/deactivate`, strict `expectedVersion` request body, P01 session guard, transaction with conditional account/selected-mode/profile/media checks; owner-only privacy-safe `/v1/profiles/me/:mode/preview`; all future third-party preview paths fail closed with 404.
3. `media-routes.ts`: photo assignment updates must clear a previous activation request; photo removal is allowed but does not silently keep or restore activation.
4. `profile_models.dart`, `profile_service.dart`, `profile_workspace.dart`: real typed activation HTTP requests, independent switches on the *private setup-complete page*, strong paused-state warning, privacy-safe owner preview (up to two authenticated photo previews), and network failure recovery. **No P03 discovery implementation or public visibility is enabled.**
5. Guided onboarding: single **Save & Next** action replacing Save handle, Save common details, Save mode details and Next. Back/swipe backward remain; forward transition validates the current saved authoritative state. The user can still save incomplete drafts in the backend; the one-button wizard does not advance them until complete.
6. P02-3 verification scripts, unit tests, Flutter widget tests and the P02-2 physical UI journey extended with checkpoints 14–15. The Android UI journey must never call the removed `p02-save-common` key.

## Privacy/activation state contract

- `requestedActive=false` → `inactive`.
- `requestedActive=true`, changed identity/setup revision or missing mandatory fields/photos/unselected mode → `paused_ineligible`.
- `requestedActive=true` with complete recorded eligible details → `pending_trusted_locality`, **not public**. Typed city is self-declared and never authorizes public discovery.
- Every current P02 response explicitly reports `discoveryEligible=false`; public cross-account preview route returns 404. P03 is responsible for trusted locality, block/match and viewer authorization, and an atomic discovery pointer before any actual public appearance.
- Replacing a draft or changing photo assignment clears requested activation; no automatic reactivation is performed. Changing the handle or shared setup invalidates the activation revision snapshot, and explicitly restarting the request is required.
- Owner previews allowlist mode, handle, display name, derived age, broad city, intention, limited interests, moderated bio and at most two opaque photo references; no email, DOB, precise coordinates or internal account ID.

## Test evidence

**Executed in the Linux authoring workspace against this patch:**

- `npm run verify:p02-3:portable` — **PASS (exit 0)**; includes 40 backend unit tests, 5 P02-3 source-contract checks, prior P00/P01/P02-1/P02-2 portable regressions, docs, secrets and cloud-operation safety.
- `node --experimental-strip-types --test apps/api/tests/unit/p02-3-activation.test.ts` — **4/4 PASS**.
- TypeScript AST syntax parsing of the changed activation/route/media and unit-test files — **PASS**; this is **not** semantic TypeScript typechecking.
- `node --check` on the new P02-3 integration and contract tests — **PASS**.

**Not executed here:** `npm run typecheck`, `npm run lint`, `npm run test:flutter`, real Fastify/DynamoDB Local/Sharp integration, and physical Android E2E. Project npm dependencies, Java DynamoDB Local and the Flutter/Android toolchain are unavailable in this environment. Do not label them as passing. Source-contract checks are supplementary, not a substitute for actual integrated behavior.

The owner's Windows/Android commands below remain mandatory.

### Owner Windows gates

```powershell
npm run verify:p02-3:portable
npm run typecheck
npm run lint
npm run test:p02-2:store
npm run test:flutter
# Start DynamoDB Local manually, then Fastify in another terminal: npm run dev:api
npm run test:p02-1:integration
npm run test:p02-2:integration
npm run test:p02-3:integration
npm run test:flutter:p02-3:e2e
```

The Android E2E must use `com.example.uluv.p02isolated`, `--no-uninstall`, and never clear `com.example.uluv` credentials. The native gallery chooser is a separate manual acceptance check.

## Scope exclusions

No new DynamoDB table/index, no S3/AWS network call, no production image service, no real payment, no P03 H3 indexing/discovery, no real third-party public preview, no login/Keystore/30-day reauthentication change, and no redesign of original gender identity or romantic preference policy. The P01-1 Android OTP automation exception remains a historical FAILED/owner-local-waived result, not a pass.
