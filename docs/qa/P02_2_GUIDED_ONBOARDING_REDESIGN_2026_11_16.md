# P02-2 guided onboarding — implementation and QA, 2026-11-16

## Contract and scope

Owner requested replacing the long, always-visible Common/Dating/Friendship editor with a horizontal-swipe-capable, strictly sequential setup journey. The final step is a read-only review of all saved details. Existing P02-2 backend endpoints, 18-table DynamoDB architecture, local-only media adapter, P01 auth, and Dating/gender contract are retained unchanged. This is **not P02-3 activation** or P03 discovery.

### Sequence

1. Common Profile — save unique handle, shared name, broad city, explicit gender selection (including original *Prefer not to say*) and one or both enabled modes.
2. Dating details — only if Dating was **saved as enabled**; save bio, intention and at least one interest. Separate display name remains optional.
3. Dating photos — only if enabled; assign at least two distinct owner-READY photos. Maximum six. Existing photos may be reused.
4. Friendship details — only if Friendship was **saved as enabled**, with the same independent rules.
5. Friendship photos — only if enabled; two valid photos required, reuse allowed.
6. Review — read-only shared and enabled-mode details, photos and counts; Continue goes to existing private completion screen, never auto-activates discovery.

Unavailable stages are omitted for disabled modes. Users may tap Back, swipe right or select an earlier step chip without a completion gate. Going forward via Next, left swipe or step chip is allowed only **one stage at a time** and only if the **server-authoritative saved state** validates the current step. Unsaved local inputs cannot unlock the next stage. Photo operations deliberately invalidate prior server readiness until a successful fresh owner-dashboard read.

## UX decisions

- Remove redundant `Saved account details` block. Saved content is visible in the editable fields on return/reload and in the final review.
- Warnings and validation failures use the theme error red and `FontWeight.w700`; non-error progress/success messages retain neutral presentation.
- Keep form controllers and per-mode unsaved snapshots when moving backward; prevent duplicate concurrently mounted mode editors during page transitions.
- Keep Home/Settings bottom navigation untouched; existing Settings security actions remain independent.
- Keep the existing photo panel API, ownership checks, maximum of six, assigned media persistence and temporary `.local/media/` storage. No real AWS/S3.

## Test gates and evidence

- `npm run verify:p02-2:portable`: runs P00/P01/P02-1 portable regressions, P02-2 contracts, UI-journey contracts and six additional guided-step/source negative safeguards. **Executed in authoring environment: PASS.**
- `npm run test:flutter`: updated widget tests for real state transitions, locked future steps, saved handle, mode-only flow, two-mode flow, photo removal relocking, red warnings, Back, old editor state restoration and cold restart. **Not executed in authoring environment: Flutter SDK absent.**
- `npm run test:flutter:p02-2:ui:e2e`: updated real `UluvApp` UI test with P01 login and 13 checkpoints. It now navigates actual stage boundaries, not removed `p02-saved-*` widgets. The isolated Android test-app requirement and final real tap remain. **Not executed in authoring environment: Windows/physical device required.**
- `npm run test:p02-2:integration` and API-driven device E2E: unchanged backend behavior; rerun for regression confidence.
- `npm run typecheck`, `npm run lint`, `npm run test:p02-2:store`: Windows verification required if dependencies unavailable. Do not claim successful execution of unavailable checks.

## Owner acceptance checklist

1. Use a new or existing account; Common is the first visible step.
2. Confirm Next and forward swipe do **not** advance without saving all required Common fields and at least one mode.
3. Verify Save handle and Save common details are separate, and city/gender/mode state reloads exactly.
4. Confirm only enabled modes have steps; verify independent Dating/Friendship draft saving.
5. Confirm 0/1 photo blocks forward progress; 2 verified assignments unlock; removing a photo relocks.
6. Confirm reuse across Dating/Friendship without another upload and all photo controls still work.
7. Confirm Back and right-swipe always work, including while editing unsaved text, and later Next stays locked until it is saved.
8. Confirm no `Saved account details` card; warnings are bold red and final Review shows all saved fields and photos.
9. Confirm final Continue reaches private completion only, not public discovery.
10. Verify Home/Settings navigation, logout, cold restart, and the **real Android gallery/Files chooser** manually. Automation intercepts the picker with deterministic test images.

The latest user report before this change was that prior P02-2 automation passed. **That evidence predates this UI redesign** and cannot count as acceptance of the new flow. Await all Windows/Android checks and explicit owner approval before closing this continuation or starting P02-3.
