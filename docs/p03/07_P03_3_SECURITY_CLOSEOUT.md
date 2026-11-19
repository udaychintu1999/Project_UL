# 07 — P03-3 security closeout, source provenance and owner decision gates

**19 November 2026. Scope: P03 only. Do not begin P03-4 or create a public discovery route.**

## Two different evidence checkpoints — do not merge them

1. **Already owner-verified on Windows (before this follow-up):** original `npm run verify:p03-3` after restored inherited test scripts, legacy docs references and the corrected GPS mock. Owner log shows **15/15 P03 portable PASS**, **11/11 full P03 acceptance PASS**, **81/81 Flutter widgets**, **7/7 isolated Android E2E**, strict TypeScript/lint and the real **P03-3 private pointer publication/deactivation/CAS DynamoDB Local** test PASS. The Android E2E is actual Android Flutter + synthetic loopback HTTP, not native GPS, real account login or live CloudFront.
2. **Owner proof on 19 Nov:** the new `reconcileRestrictedPointers` source contract **1/1 PASS** and Java DynamoDB Local integration **1/1 PASS**, run separately. The 19 Nov combined `verify:p03-3` reached P03 portable gate **15/15** but **FAILED on an inherited test requiring `NOT YET RUN`** in an evidence document that now truthfully records prior PASS. Later full gates were NOT RUN in that attempt. This package repairs that assertion, includes the previously omitted repair integration in the main command, and fences activation against mixed profile/media snapshots. **A fresh combined owner run is required after overlay.**

P03-1/P03-2 remain owner-accepted **for local automated development**; neither is approved as a production release. P03-3 private core is verified but the total moderation/block/deletion lifecycle is **not implemented**.

## Restricted-account pointer repair: bounded, fail-closed and NOT authorization

- New server-private `apps/api/src/features/discovery/reconcile-restricted-pointers.ts` accepts a UID only from a future **trusted internal caller**. It **cannot** authenticate an admin, restrict a member, delete an account, or be called through HTTP. These workflows remain absent in the supplied backend.
- Reads three exact canonical keys with `ConsistentRead=true`: account (`uluv_users USER#uid/META`) and Dating/Friendship mode rows (`uluv_profiles USER#uid/MODE#...`). No `Query` or `Scan` or users enumeration.
- If account is active/missing/invalid, **reject without mutation**. For already non-active accounts, validate each canonical anchor, compare the account's status/moderation restriction revision, and use a single atomic `TransactWrite` containing up to **two pointer deletes**, **two mode updates/guards** and **one user ConditionCheck** (five transaction operations maximum). This does **not** touch P03-2 read/query budgets.
- A second invocation is a no-op if anchors are already absent. A raced mode edit/status change fails the transaction. A pointer with the wrong `uid` cancels the **whole transaction** rather than deleting another member's row; both modes remain untouched.
- **Limitation:** an old index row lacking a canonical `discoveryPointer` anchor cannot be located safely by UID using the current partition schema. Fail closed on public reads when eventually built; do not invent an unbounded global `Scan` or bypass reader validation. Restricted-account repair is an explicit internal tool, not a background job.

## Unresolved owner/security decisions — block final P03-3 acceptance

| Gate | Why it matters | Required future action |
| --- | --- | --- |
| Moderation authorization/status contract | No privileged staff moderation route or immutable audit operation is implemented. A repair helper cannot make moderation actions safe by itself. | Specify authorized actor, restriction state machine, audit/idempotency, conditional status transition and synchronous pointer invalidation. Test real DB concurrency/rollback and session failure. |
| Account deletion/privacy lifecycle | No full account deletion/revocation handler exists; authentication links, media, profile and pointer anchors need retention decisions. | Explicitly approve deletion/retention contract, integrate atomic inhibit-first status and bounded multi-table cleanup + durable retry. Never infer permission from this repair helper. |
| Blocking policy | `uluv_blocks` key layout exists but no block/unblock service or public reader. Global publication cannot be paused for every other viewer by default. | Choose viewer-pair suppression (mutual direction checks at hydration) or globally restrict publishing. Approve policy and test both directions. No exposure before P03-4 canonical hydration. |
| Location revision/consent UX | Existing geo edit removes old pointers and requires fresh explicit activation, while an old `requestedActive` intent may remain private; Android UI may still display the intent. | Approve this contract (or an explicitly alternative owner consent flow), then document and test its UI communication and anchor/revision fences. |
| Unexpected media expiry/moderation | Public reads must never treat an old index row as proof of READY media. Media admin transitions are not wired in supplied source. | Design the external transition hook and guarantee canonical photo readiness rechecks per candidate before P03-4. |
| Reconciliation of legacy orphan rows | Exact canonical anchor repair cannot find pre-anchor/disconnected rows outside known H3 PKs. | Define a controlled migration/repair inventory with authorization, bounded reads and measured resources; never use global Scan in request paths. |

**No product policy has been silently approved** by implementing the private helper. P03-3 final owner acceptance requires completing applicable missing operational transitions or a documented and explicitly approved phase-boundary re-scope before P03-4. Do not treat the full test PASS of existing code as proof that these absent flows exist.

## Windows owner acceptance runbook

At repo root, after a Git commit/backup and overlay of the changed-files package, keep **your manually started Java DynamoDB Local**, existing 18 tables and independently launched Fastify `npm run dev:api` running. Connect the authorized isolated Android test device via USB. Do **not** run `npm audit fix --force`; dependency advisories are a separate evaluated backlog. Never share `.env` or real account credentials.

```powershell
# Verify recovered historical files are still present; do not replace them with stubs.
@(
 'scripts/verify/p02-1-account-navigation.test.mjs',
 'scripts/verify/p02-5-visual-contracts.test.mjs',
 'scripts/verify/p03-pre-discovery-shell.test.mjs',
 'scripts/verify/p03-four-tabs-and-documentation.test.mjs',
 'apps/flutter_app/test/p03_pre_discovery_shell_test.dart'
) | ForEach-Object { if (-not (Test-Path $_)) { throw "Missing: $_" } }

npm run test:p03-3:repair:contracts
npm run test:p03-3:repair:integration
npm run test:p03:acceptance:plan  # repaired historical evidence assertion
npm run verify:p03-3              # Now includes the new repair gates
```

The real DB repair test writes synthetic test-owner rows only, uses `local-safety` loopback enforcement, asserts restricted-owner and hostile row rollback behavior, checks retry idempotency and cleans up exact keys. **If any gate fails: P03-3 closeout is NOT accepted.** Share only sanitized failures with the next agent. Native OS GPS/permission, actual OS force-stop/reopen and live CloudFront/OAC remain independent manual/unverified gates; no S3/CloudFront write is authorized.

## Source ZIP divergence — don't erase recovered work

The last uploaded full `Project_UL-master(4).zip` was taken **before** the owner's GitHub recovery of four historical JS tests and the local `docs/handoff/TECHNICAL_DOCS_INDEX.md`, restoration of legacy `docs/api/P03_GEO_AND_SHELL_API_CONTRACTS.md`, and replacement of the GPS mock test. This follow-up is built from the uploaded full ZIP **plus** the earlier P03-3 candidate ZIP, the focused GPS fixture repair ZIP and the provided recovered legacy API/Flutter test files. We do **not** have the final current Windows repository. Accordingly, this package is a **changed-files-only overlay**, not a claim of exact byte parity with the owner's working tree. Protect locally recovered files, inspect `git diff`, resolve any overlaps before applying and do not extract an older full ZIP over them.

## P03-only documentation cleanup — safe inventory

- **KEEP:** source-governing P03 architecture/API documents, P03 living `README` and chapters 01–07, P03 historical QA incident and failure evidence, earlier normalized P03 source contracts.
- **MERGE:** old Geo/shell API manual's unique implementation details into `docs/p03/03_API_REFERENCE.md` (the old file is retained temporarily because a historical test still reads it); outdated living status statements have been reconciled against the owner's full 18 Nov log. Do not duplicate stale status banners.
- **ARCHIVE CANDIDATES:** four old P03-only manual files listed by `docs/p03/PRUNE_SUPERSEDED_P03.ps1`. The script is dry-run by default. Retain until backlink and uniqueness review on the **owner's latest** Git tree, which has more files than the uploaded ZIP.
- **DELETE NOW:** **none**. Deletion manifest is empty. Never delete or edit P01/P02 documents or their dated evidence.

Older GitHub-restored source test `scripts/verify/p03-four-tabs-and-documentation.test.mjs` and `docs/handoff/TECHNICAL_DOCS_INDEX.md` are **not present in the uploaded full ZIP**. They still require a file-level audit in the owner's current tree to safely migrate assertions from `docs/api/P03_GEO_AND_SHELL_API_CONTRACTS.md` to `docs/p03/03_API_REFERENCE.md`. Do **not** weaken or remove assertions, make blank replacement docs, or delete the legacy document just to get a green run. Existing working tests take precedence until that audit. No blanket deletion or silent script rewrite is included in this package.
