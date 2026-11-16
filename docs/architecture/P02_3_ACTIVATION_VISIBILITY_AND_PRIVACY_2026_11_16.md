# P02-3: Activation and privacy boundary

**Independent requested activation is not public discovery.** Owner-controlled Dating and Friendship profile states are separate records in the existing `uluv_profiles` table, keyed by `USER#<uid> / MODE#DATING` and `USER#<uid> / MODE#FRIENDSHIP`. No new table or GSI is introduced.

An activation command requires a valid existing P01 session, `expectedVersion`, an active/self-declared-adult account, selected mode, persisted shared/mode details, and at least two distinct owner-READY, mode-assigned photos. Use exact-key reads, bounded BatchGet, DynamoDB conditional transactions; do not scan. The account identity revision, shared `setupRevision`, media state and per-mode version are checked before a requested activation is committed. `activationIdentityRevision` and `activationSetupRevision` snapshot the accepted state.

For later edits: a new mode draft or mode photo assignment clears requestedActive under the existing version condition. A shared detail or handle change invalidates the snapshot and results in `paused_ineligible`. Restoring data cannot automatically turn on the old request; the user must explicitly re-request. This avoids accidental publicity after removing sensitive information.

P02 uses a self-declared broad city label and *never* an authenticated/verified location cell. Accordingly an otherwise eligible request is `pending_trusted_locality`, always `discoveryEligible=false`. There is **no insert/update to `uluv_discovery`**. P03 must separately implement trusted locality, authorized viewer/block/match filtering, and an atomic discovery pointer before public visibility. Legacy/current cross-user preview routes deliberately return 404.

A private owner preview is an allowlisted projection with at most two opaque photo references. Media remains served only by the existing authenticated owner-only endpoint. No email, date of birth, phone, address, precise coordinates, account UID, disk path, token or session metadata appears in the preview.

Gender identity options and romantic preference contracts retain the approved original U_luv product policy. Activating a mode does not imply hidden algorithmic ranking or automatic opposite-gender matching.
