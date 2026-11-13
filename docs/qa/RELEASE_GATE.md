**Cross-phase manual/automation rule (2026-11-13):** See `docs/qa/MANUAL_VERIFICATION_ESCALATION.md`. An owner-observed manual PASS supports local feature evidence but never turns a failed automated check into PASS. A documented owner-accepted **development-only** exception may allow work on the next slice of the same phase; it does **not** waive production/release, identity, security, privacy, money or required provider verification. Never disable a failing gate to change the result.

# Release and phase-gate policy

## Status vocabulary

| Status | Definition |
|---|---|
| `PASSED` | Test actually executed and observed expected result with command + evidence. |
| `FAILED` | Test executed and failed, with reproduction steps. |
| `UNVERIFIED` | Not actually run (missing SDK/Java DynamoDB Local/emulator/credentials/time), even if tests/scripts exist. |
| `NOT_APPLICABLE` | Does not apply; include reason. |
| `CORE_FLOW_VERIFIED` | All phase-critical D1/D2/D3/T1/T2/T3 acceptance checks executed and passed in the claimed environment. |
| `PARTIALLY_VERIFIED` | Deliverable code/tests exist; important integration/runtime checks remain UNVERIFIED. |
| `RELEASE_BLOCKED` | A demonstrated P0 safety, authorization, money, data-loss, or main user-journey failure exists; release must not proceed. |

## P0 non-negotiables

- Flutter main UI truly talks to backend and DynamoDB Local; no placeholder button pretending success.
- Signup, profile activation, Dating paid Like Back vs free ordinary Like, matching, Connect, Friendship request, real chat, Local post with photos, local visibility, comment/react, moderation and wallet purchase integrity.
- Duplicate idempotent actions do not double charge; blocked/ineligible accounts cannot interact; expiring content is not returned.
- Baseline incident reporting/blocking/age policies are operational before user-generated content is public.
- Production rollout needs actual permitted provider credentials and live/sandbox environment verification as applicable. Unit tests alone do not pass P0.

## Evidence minimum

For each test entry record: date, phase, environment, command, test case/fixture, exact outcome, log path/summary, status, remediation/next action. Distinguish DynamoDB Local from mocked storage; widget test from physical Android; store fixture from payment sandbox. Any missing test has an explicit human command and blocker.

The **current v2.0 P00 starter** has executed portable/unit/security checks (see `docs/qa/EVIDENCE_LOG.md`); **no live Java DynamoDB Local + Fastify + Flutter device core-flow test has been evidenced** in this authoring environment. `npm run verify:p00:portable` is source-only, while `npm run verify:p00` requires the live automated full stack and fails closed if unavailable.
