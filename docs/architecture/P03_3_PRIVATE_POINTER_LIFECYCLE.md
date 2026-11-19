# P03-3 — Private eligibility and transactional H3 pointer lifecycle (implementation candidate)

**18 Nov 2026; AUTHORING SOURCE WRITTEN, NOT OWNER ACCEPTED.** P03-1/P03-2 remain owner-accepted for local automated development. This document describes only P03-3 changes and their remaining blockers. A private pointer is not a public identity or an authorization grant. There is still **no authenticated people-feed API, third-party preview, Flutter results screen or public discoverability**.

## Existing canonical and projection keys

| Table/key | Authority/use |
| --- | --- |
| `uluv_users: USER#uid / META` | Account `status=active`, self-declared adult, DOB, identity revision and current handle. No implicit ability to publish when moderation policy is unknown. |
| `uluv_settings: USER#uid / SETTINGS` | Owner's selected modes, setup revision, settings revision, approved H3 R6 cell/center, locality revision and source. Original GPS fix not stored. |
| `uluv_profiles: USER#uid / MODE#DATING or MODE#FRIENDSHIP` | Canonical version, independent `requestedActive`, activation setup/identity revisions, assigned photos. New optional `discoveryPointer` anchor `{PK, SK, localityRevision, profileVersion}` (internal only). |
| `uluv_profiles: USER#uid / MEDIA#id` | Owner-assigned READY media with `refCount >= 1`; at least two distinct assigned READY photos per mode. |
| `uluv_discovery: DISC#MODE#R6#cell / JOIN#ISO#uid` | One *private, unverified* projection per active mode. Fields `uid,mode,homeCell,localityRevision,profileVersion`. Index presence is NEVER permission to show another person. |
| `uluv_blocks` / moderation restrictions | Mandatory future per-viewer (mutual blocks) and account/mode restriction checks before any P03-4 public result. The present repository has no complete block/admin/delete transition handlers, so global revocation is **not fully closed out**. |

No table, new GSI or breaking index key format. Only one optional internal canonical anchor field is added to existing mode records. Old P02 drafts without the anchor remain valid and invisible.

## Publisher vs reader decisions

- **Publisher input:** only the authenticated owner UID from the pre-existing device-bound session. `POST /v1/profiles/me/:mode/activate` is an explicit independent existing owner activation intent. The server validates account active/self-declared adult and DOB >=18; shared/mode readiness, two distinct owner-assigned READY photos; current handle and setup/identity revisions; and, only for publishing, a verified server-approved H3 R6 center/source with positive locality revision. An intent without a trusted locality remains privately pending with **no pointer**. The activation writer also refuses to publish when the separately read dashboard/READY-media projection is from a **different canonical profile version**, or when the verified media IDs do not belong to the current canonical assigned-photo list; deactivation still works for incomplete profiles. This follow-up guard needs full Windows integration recheck.
- **Mode state:** P02 `requestedActive` and the existing response `discoveryEligible:false` are preserved. A pointer is not exposed to Flutter. There is no new automatic public consent inference.
- **Reader eligibility:** no reader exists in P03-3. P03-4 must re-read canonical account, profile, settings, READY media, mode state and revisions **and** mutual blocks, moderation/safety/privacy and viewer filters on every request; require candidate anchor equality with returned index key, profileVersion and localityRevision, plus exact approved-center radius. An index row alone never authorizes a response.
- **Open product/safety decision:** whether a per-user block is a *viewer-specific suppression* (the sensible current model) or a global publisher pause must be explicitly decided before full P03-3 acceptance. Global moderation/account deletion integrations are not present, so do not claim all revocation triggers are implemented or that any user is publicly discoverable.

## Actual transactional transition map

| Trigger already implemented | Private pointer behavior | Concurrency protection |
| --- | --- | --- |
| Explicit Dating/Friendship activation | One private pointer `Put` and canonical `discoveryPointer` update in the same `TransactWrite`; optional old pointer `Delete`. If trusted locality absent, record only existing private intent | Account status/age/DOB/identity check; mode version, current anchor, selected mode, setup/settings/location revision/cell/source checks; assigned READY media ConditionChecks; `attribute_not_exists(PK)` on new pointer |
| Explicit mode deactivation | Delete old pointer, remove canonical anchor and change `requestedActive=false` in one transaction | Same profile/version/anchor checks; no media readiness needed to revoke |
| Mode draft edit; photo assignment/removal | Existing mode update clears active intent and the anchor, deletes pointer atomically | Profile-version and anchor compare; READY media ref counts still transactional |
| Shared setup/mode selection change | Invalidate **both modes** (even when only one enabled); old pointers deleted and active anchors removed atomically with settings update | Mode absence/versions and prior anchor conditional barriers; account status and settings setup revision |
| Handle/identity revision change | Invalidate both mode pointers atomically with identity/alias transaction; old activation revisions no longer qualify | Identity version, prior handle and old/new alias CAS; both profile barriers |
| Manual locality save / one-shot GPS save | Invalidate both pointers and anchor, never publish from location request itself; already active intent requires another explicit activation | Settings optimistic revision+cooldown, adult status, profile presence/version/anchor barriers. H3 is recomputed server-side; raw fix excluded |
| READY media transitioned/expired while assigned | Existing storage does not provide this as a legal mutable transition (`refCount` prevents delete). An unforeseen moderation/media expiry path requires a future transaction hook and P03-4 canonical recheck | **NOT YET IMPLEMENTED** as an external/admin transition |
| Global moderation restriction, account status downgrade/deletion | No complete handlers in supplied baseline. Must synchronously revoke or gate canonical state first, with a durable bounded repair path; never expose stale pointers | **BLOCKING GAP** for final lifecycle acceptance |
| Two-person block/unblock | Future reader must check *both* block directions on every hydration. Do not suppress everyone worldwide because one viewer blocked an account by accident | **MISSING ROUTE/PRODUCT RULE**; no public read is on |

Settings/identity flows condition-check even nonexistent/inactive profile rows, so a concurrent creation/activation cannot slip between a preflight read and settings commit. A failed transaction performs no partial pointer publication or partial mode revocation. A same-millisecond reactivation advances `JOIN#ISO` by at least 1 ms to prevent DynamoDB's duplicate-item transaction restriction. Deletion is idempotent if the old index row was already absent, but never deletes a row belonging to another owner.

## Partial failure/reconciliation limits

1. **Atomicity:** source-supported writes use a single DynamoDB transaction. If the reply is lost after commit, clients must re-fetch owner profile state/version; never replay an old expectedVersion with forced overwrite. Conflicts fail as 409; storage errors as 503. There is no compensating multi-write window for implemented transitions.
2. **Repair:** the canonical anchor identifies the exact old index key, allowing a future authenticated, bounded owner reconciliation to delete stale known projections without Scan or a new table. No background/automatic repair job is registered now; full administrative moderation/account-deletion repair must be specified and tested before acceptance. Legacy orphan rows without an anchor cannot be safely located by UID using the current PK-only schema; do not claim they were cleaned.
3. **Old-version and corrupt anchors:** malformed canonical anchors fail closed; no guessing pointer PK from client input. A query/hydrator must discard any row whose current canonical profile/owner settings do not match its revision, mode and home cell, even if obsolete projections remain.
4. **Scope:** no new service, no S3/AWS operation, no cash/payment, no P02 session protocol changes, no public route. P03-2 budgets remain max six strongly consistent partition `Query`, 72 raw items, 12/partition, 24 internal pointers and 1,600-cell coverage, ten-minute context-bound AES-GCM cursor.

## Proof required before acceptance

Run `npm run test:p03-3:policy`, `npm run test:p03-3:contracts`, then the targeted `npm run test:p03-3:integration` on owner-started Java DynamoDB Local; follow with `npm run verify:p03-3` for all inherited P01/P02/P03, TypeScript, lint, Flutter and device checks. The new test is a **real Fastify + DynamoDB Local** integration (not a mock): synthetic isolated account, two READY media items, activation/republication/deactivation, concurrent CAS, missing READY media, draft, setup, identity, no public preview; explicit cleanup. Geolocation transactional mutation integration and moderation/account deletion still need additional targeted acceptance/implementation before entire P03-3 sign-off. See `docs/p03/04_ACCEPTANCE_AND_RELEASE_GATES.md` and `docs/qa/P03_3_POINTER_LIFECYCLE_IMPLEMENTATION_EVIDENCE.md`.

**Status: PARTIALLY VERIFIED / RELEASE BLOCKED for P03-3. Do not proceed to P03-4 yet.**

## Verified local core and post-restriction repair candidate — 18 Nov 2026

Owner's final `npm run verify:p03-3` log after recovered tests and fixed GPS fixture reports **15/15 portable PASS, 11/11 full P03 PASS, P03-3 real Fastify+DynamoDB Local transaction PASS, Flutter 81/81 and physical Android 7/7 PASS**. Historical authoring-only *UNVERIFIED* wording above predates this owner evidence. It does not prove future staff moderation, blocking or deletion behavior.

`reconcileRestrictedPointers` is an additional **private restricted-account-only recovery helper** (owner contract + real local DB tests passed 19 Nov; combined retest pending). It makes three strongly consistent key reads for a supplied UID (account plus two mode records), refuses an active/missing account, validates anchors from canonical mode rows, and conditionally deletes anchored pointers/clears anchors transactionally against account status/restriction revision and mode version. The helper does not enumerate users, query neighboring cells, update staff restrictions, create an endpoint, or permit an index pointer to authorize a user preview. It cannot clean a legacy orphan where the anchor is missing; therefore future canonical reader validation remains mandatory.

**P03-3 final integration blockers remain:** trusted staff/account-deletion transition authorization + atomic cross-table revocation where feasible; unanchored orphan migration/repair decision; explicit block policy (reader-specific mutual suppression vs global publisher action); separate approval for location-change reactivation semantics; full owner verification of this follow-up. Until these are addressed, **do not mark all P03-3 lifecycle requirements accepted or start P03-4**.
