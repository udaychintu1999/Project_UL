> **19 Nov 2026 owner update:** restricted pointer recovery **1/1 policy contract PASS + 1/1 Java DynamoDB Local integration PASS** independently. The later combined `verify:p03-3` halted at portable gate 15/15 on a historical `NOT YET RUN` docs assertion (source required outdated text), not a private-pointer test failure. This corrective patch repairs the expectation, wires repair integration into the fail-closed combined command and guards activation against mixed-version media snapshots. **Post-fix full owner verification NOT YET RUN; P03-3 final moderation/block/delete lifecycle remains unaccepted.** Historical authoring-only results below remain unchanged.

> **OWNER-RUN UPDATE 18 Nov 2026:** After restoring missing inherited tests and repairing the GPS test fixture (not production GPS code), the owner supplied a log ending `P03 LOCAL AUTOMATED GATES PASSED`: **P03 portable 15/15 PASS; P03 full 11/11 PASS; real P03-3 Fastify+DynamoDB Local transaction PASS; TypeScript/lint PASS; Flutter widget 81/81 and physical Android 7/7 PASS**. This supersedes the older *"owner verification pending"* statements **for that tested core only**. Original historical failure evidence below is retained; that 18 Nov remark about the restricted-account repair being untested was superseded by the 19 Nov owner-run 1/1 contract and 1/1 live DynamoDB Local PASS above. Moderation/block/account-deletion implementation and native OS/CloudFront manual gates remain unverified.

---

# P03-3 — Authoring implementation and verification evidence (18 Nov 2026)

**Milestone:** private, transactional pointer lifecycle implementation candidate; **NOT owner-accepted; do not enable public discovery.** P03-1/P03-2 remain accepted for local automated development on the owner's earlier evidence, distinct from this patch.

## Code and file changes

- New `apps/api/src/features/discovery/pointer-lifecycle-policy.ts` — canonical pointer anchor validation, idempotent owner-only index deletion, revocation barriers for absent/inactive/active modes, same-key CAS and collision-proof join timestamp.
- Updated `apps/api/src/features/profiles/routes.ts` — private pointer on explicit activation with trusted server-selected locality/READY media; deactivation, draft, common setup and handle edits atomically invalidate pointer(s). Existing owner DTO remains `discoveryEligible:false`; third-party previews remain 404.
- Updated `apps/api/src/features/profiles/media-routes.ts` — assigned-photo edit invalidates pointer in same transaction; no public photo downloads.
- Updated `apps/api/src/features/geo/routes.ts` — manual and one-shot GPS settings saves invalidate both mode pointers through conditionally fenced transactions; raw fix never persisted.
- New `scripts/verify/p03-3-pointer-policy.test.mjs`, `p03-3-source-contracts.test.mjs` and `apps/api/tests/discovery/p03-3-private-publication-dynamo.test.ts` with synthetic account/full live Fastify+DynamoDB test path. New `package.json` scripts and `tsconfig.p03-acceptance.json` include the acceptance test.
- P03-only documentation updates, no P01/P02 document or Flutter source modifications.

## Results actually observed in authoring environment

| Command / evidence | Result | Limit |
| --- | --- | --- |
| `node --experimental-strip-types --test scripts/verify/p03-3-pointer-policy.test.mjs` | **PASS 6/6** | Pure owner/index policy and synthetic transaction construction only; not DB commit |
| `node --test scripts/verify/p03-3-source-contracts.test.mjs` | **PASS 6/6** | P03 private boundary, recovered Flutter paths and P03 documentation links |
| `node --experimental-strip-types --test <all p03-*.test.mjs except live HTTP>` | **PASS 56/56** | Static source/policy contracts only; live API requires local env |
| `node --experimental-strip-types --test scripts/verify/p02-*.test.mjs` | **PASS 40/40** | Present P02 static contract files; separate 2 absent P02 scripts still block inherited verifier |
| `node scripts/verify/docs-check.mjs` + `source-contract.mjs` + `secret-guard.mjs` + `cloud-operation-guard.mjs` | **PASS all four** | Offline document/index/secret/loopback guards |
| `npm run verify:p03:acceptance:portable` | **BLOCKED** at inherited `test:p02-1:navigation:contracts` | Missing pre-existing `scripts/verify/p02-1-account-navigation.test.mjs` in the **uploaded baseline ZIP**; owner must recover correct original test |
| TypeScript `transpileModule` syntax diagnostics on five touched/new TS source files | **0 syntax diagnostics** | Not a semantic TypeScript compiler/typecheck |
| NPM dependency installation (`npm ci --ignore-scripts`) | **BLOCKED** by unavailable/unfinished package registry download | No SDK/Fastify/h3/tsx installed in authoring runtime; cannot run integration, lint, full suite |
| Java DynamoDB Local / physical Android / Flutter SDK | **UNVERIFIED** | Java binary exists, but DB runtime/SDK and Flutter are not available in this container; do not substitute mocked PASS |
| P03-1/P03-2 owner evidence from handoff (prior ZIP) | **OWNER-ACCEPTED 18 Nov 2026, historical** | Previous 11/11 twice; expanded 7/7 separately + analyzer clean; post-recovery combined 11/11 not evidenced |

All P03-only source and doc checks above were rerun after the documentation repair. Full inherited portable acceptance remains BLOCKED by the pre-existing missing test files listed below, and all missing Windows/device checks remain UNVERIFIED until actual owner logs are provided. Do not portray a static source contract as a real DynamoDB transaction run.

## Unclosed P03-3 issues (block acceptance)

1. **Moderation/account deletion handlers:** supplied source lacks the complete lifecycle routes and authoritative restriction states; implement and test revocation-before-read semantics with a product/security decision. Do not create a public endpoint first.
2. **Mutual blocks/owner visibility policy:** define whether a block is viewer-specific (normally checked at read time) or globally suspends publishing, and specify how privacy/consent changes invalidate publication. No block service exists to certify against yet.
3. **Geo move behavior:** current conservative choice revokes on location update and requires a new explicit owner activation; does not silently move or republish. Owner should approve this UX before final acceptance.
4. **Inherited verifier source holes in uploaded ZIP:** `scripts/verify/p02-1-account-navigation.test.mjs`, `scripts/verify/p02-5-visual-contracts.test.mjs`, `scripts/verify/p03-pre-discovery-shell.test.mjs`, and `scripts/verify/p03-four-tabs-and-documentation.test.mjs` are referenced by existing npm scripts but absent. The earlier four missing Flutter production sources **are present**. Recover the genuine accepted tests from Git/source provenance, not dummy PASS replacements or disabled gates. No P01/P02 files have been added or rewritten by this P03-3 patch.
5. **No owner Windows verification yet:** test actual DynamoDB transaction semantics, concurrent writes, rollback/failure cleanup, all P02/P03 regressions and Android/OS manual gates. A one-test failing gate blocks acceptance.

See `docs/architecture/P03_3_PRIVATE_POINTER_LIFECYCLE.md` for the transition table and `docs/p03/04_ACCEPTANCE_AND_RELEASE_GATES.md` for exact PowerShell commands. No cloud operations, P03-4, new index or production release are authorized.
