# P03-2 discovery infrastructure — private/internal

Exports contain H3 R6 coverage, exact approximate-center distance filters, canonical
pointer-key constructors, authenticated encrypted progress cursors and a *bounded
internal pointer reader*. Nothing here is registered as a public API endpoint,
performs a pointer write, or returns discoverable users. A pointer is NEVER enough
for authorization: P03-3/4 must implement atomic publication and independent
canonical account/profile/block/eligibility hydration before any client response.

- Sources: `uluv_settings` consistent GetItem, `uluv_discovery` PK Query.
- No Scan, `Query` per R6 partition only, max 6 calls / 72 raw items per request.
- No auto-widen beyond 50 km; overlapping H3 cover plus exact geodesic filter.
- `0–10`, `(10–35]`, `(35–50]`; all `0–50` is staged near-band-first.
- Cursor is AES-256-GCM with viewer, mode, settings/locality revisions, cell,
  source, page size, distance band bound to it; expires in 10 minutes.
- Unverified pointer rows stay inside Fastify. Client never receives uid or cell.
- P03-2 does not update profile `discoveryEligible:false` and does not make
  existing P02-3 `requestedActive` profiles publicly visible.
- This module does not mint/obtain secret keys; future handlers inject a
  separate high-entropy server-owned 256-bit signing/encryption secret.
- Query results within one page can be sorted by approximate distance, but
  pagination does NOT guarantee globally nearest-first ordering over unvisited
  H3 partitions; no claim of full global order should appear in UI.
