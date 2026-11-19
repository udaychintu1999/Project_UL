# 05 — P03-3 private pointer lifecycle, safety and recovery

**Scope:** only private H3 R6 pointer publication and revocation. There is still no public people discovery, third-party preview, Flutter people-feed or P03-4. A pointer is a stale-prone *candidate locator*, never permission to disclose an identity.

## Canonical versus projection keys

| Authority | Key | Role |
| --- | --- | --- |
| `uluv_users` | `USER#uid / META` | Canonical account `status`, self-declared adult, DOB, identity and `moderationRestrictionVersion` |
| `uluv_settings` | `USER#uid / SETTINGS` | Selected modes, source-approved H3 R6 center/cell, location/settings/setup revision |
| `uluv_profiles` | `USER#uid / MODE#DATING` or `MODE#FRIENDSHIP` | Per-mode profile version, requestedActive, assigned media, optional private `discoveryPointer` anchor `{PK,SK,localityRevision,profileVersion}` |
| `uluv_profiles` | `USER#uid / MEDIA#id` | Assigned READY state, `refCount>=1`, ≥2 unique READY photos required |
| `uluv_discovery` | `DISC#MODE#R6#cell / JOIN#ISO#uid` | **Unverified** private index row; no GSI, no Scan |
| `uluv_safety` | `ADMINAUDIT#staffUid / T#ISO#actionId` | Immutable trusted restriction audit, only after separate privileged staff authorization |
| `uluv_blocks` | `BLOCKS#actor / TARGET#target` and reverse | Future P03-4 viewer-specific **mutual block** check, not global suppression |

## Atomic transition map

| Trigger | Existing implementation | Concurrency and privacy guarantee |
| --- | --- | --- |
| Explicit mode activation | Validates active/adult account, current handle/shared/mode setup, DOB, ≥2 distinct assigned READY photos, profile-version-consistent READY projection and independently approved locality | One DynamoDB `TransactWrite` condition-checks account, settings, profile/version/anchor, READY media; conditionally puts one pointer and removes old pointer. No client-selected cell or raw GPS |
| Activation without approved locality | Records private pending mode intent only | **No pointer** and no public response; later location save does not auto-publish |
| Explicit deactivation | Clears requestedActive, anchor and known index pointer in one transaction | Can revoke even if profile is incomplete; same version/anchor CAS |
| Draft or photo edit | Invalidates that mode, clears active intent, deletes known pointer | Profile version/anchor compare; photo refCount checks remain atomic |
| Handle/identity or shared mode/setup change | Invalidates **both** modes, including absent/inactive rows | Conditional absence barriers defeat concurrent creation/activation; active anchors removed atomically |
| Manual locality / one-shot GPS save | Invalidates both anchors and deletes index keys; never republishes | Settings revision/cooldown and owner-state checks with mode barriers; raw fix never persisted |
| Trusted staff restriction (new private primitive) | `restrictAccountAndRevokePointers`: changes canonical active → restricted, increments moderation revision, deactivates both mode intents, removes anchored pointers and writes staff audit in **one transaction** | Requires a separately authorized staff actor, fixed reason, valid action ID and expected moderation revision; absent profile rows get creation barriers; conflicts fully roll back. No admin route exposed |
| Already restricted account repair | `reconcileRestrictedPointers`: consistent Get of account + both modes; conditional deletes up to two anchored projections and clears anchors | Never changes account status, scans, selects a different UID or repairs an unanchored legacy orphan. Idempotent and CAS-protected |
| Viewer A blocks user B | **NOT implemented in P03-3**; decision: viewer-specific suppression, not a global publisher shutdown | P03-4 must check both block directions *at final canonical hydration*, every page and preview; no public reader exists now |
| Account deletion / media moderation / reinstatement | No authorized complete workflow in this repository | Any future workflow must first gate canonical status, atomically revoke relevant known anchors, and durably finish erasure/appeals; do not treat today's helper as full account deletion |

## Threat model and failed-transaction recovery

- Canonical anchors are validated against mode, UID, strict H3 R6 partition and `JOIN#ISO#uid` shape, nonnegative/positive revisions. Never take deletion keys from client input or a public index response. Index Delete is idempotent on an absent row but refuses rows owned by another UID.
- Concurrent activation/deactivation, settings updates, media assignment, handle changes or mode insertion are fenced by conditional checks; transaction cancellation causes **no partial status change, pointer publication or cleanup**. New JOIN timestamps advance ≥1 ms to avoid same-key delete/put conflicts.
- A lost successful HTTP reply must be resolved by a fresh owner read, not a forced retry with stale version. Invalid canonical anchors fail closed. All failures stay private; no casual debug output of real account/cell/UID or sensitive staff reason text.
- The index is PK-by-cell; **unanchored old orphan rows cannot be located per UID without a new authorized retrieval index or a bounded incident-specific known key.** No global Scan, silent table sweep, fake cleanup claim, background worker or automatic republish is implemented. Before any P03-4 public read, canonical hydration must drop orphan/stale pointers even if physically present.
- `requestedActive` is a private user intent separate from `discoveryEligible:false`; new staff restriction clears it. Restoration, appeals and owner deletion need independent policy and authorized handlers, not a blanket undo of status or automatic pointer restoration.

## Closing the P03-3 implementation boundary

The existing owner run on **19 November 2026** proved private publication, CAS/revocation, 19-Nov restricted-account cleanup, and the full P03-1/P03-2/Flutter/Android regression together. The **new trusted restriction path and doc consolidation** were authored after that log; they require targeted Java DynamoDB Local verification and a fresh `npm run verify:p03-3` before owner acceptance. This finishes the *P03-3 private pointer primitive surface* if those checks pass; it does **not** certify staff identity/permissions, block management, full account deletion, public hydration or a production release. Those are explicit integration dependencies of subsequent authorized safety/reader workflows.

See [04 — verification](04_ACCEPTANCE_AND_RELEASE_GATES.md) and [06 — roadmap](06_NEXT_STAGES_ROADMAP.md). P01/P02 contracts and original 18-table schema remain unchanged.
