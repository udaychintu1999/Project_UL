# P02-4 — Owner Windows 10 / USB Android final acceptance

This is the **final verification of P02-1 through P02-3**, not permission to begin real public discovery or production integration. Merge only changed ZIP files at project root. Do not overwrite `apps/api/.env`, `.local/media`, DynamoDB storage, Android app data, or the normal U_luv app.

## One-time preconditions (do not print/share secrets)

1. Open PowerShell at `C:\Dump\Projects\Project-ULuv-Space` (or the actual repo root).
2. Start **Java DynamoDB Local manually**, using the owner's established command/config. It must be reachable on loopback port 8000 and existing 18 tables must be present. Do not rerun first-run initialization unless it is actually needed.
3. In another persistent PowerShell terminal, start `npm run dev:api` (Fastify on loopback port 3000).
4. Connect the **physical Android phone** with USB debugging and approved adb connection. Ensure Java, Flutter and adb are on PATH. Do not launch an emulator unless specifically using an adapted runbook; this full gate is for physical Android.
5. Owner-managed `apps/api/.env` remains local and private; verify `APP_ENV=local`, loopback DB/API and existing `ULUV_DEV_TOKEN`. The verifier refuses remote/cloud URLs. Do not paste or log values.

## First, view the mandatory test plan without running it

```powershell
npm run verify:p02-4:plan
```

## Run complete automated acceptance (all 12 gates in order)

```powershell
npm run verify:p02-4
```

This runs real compilation, Flutter, live Fastify+DynamoDB Local, the media tests and **three distinct isolated Android suites**. This is more comprehensive than `verify:p02-4:portable`, which only runs offline tests. Each successful gate prints `P02-4 PASS gate N/12`; if any gate fails, the verifier exits nonzero, reports exactly which gate failed, and **does not run or report later gates**. Save the complete terminal result after redacting anything potentially private.

If blocked before runtime is available, the offline-only preliminary command is:

```powershell
npm run verify:p02-4:portable
```

An offline PASS never substitutes for the full 12-gate verifier.

## Final manual Android checks (separate from the fixture-driven tests)

- [ ] Native Android **Files/Gallery picker** genuinely opens. Choose a photo from device storage (not the injected test fixture); preview is correct, upload completes, and the image persists after app restart.
- [ ] Test real PNG/JPEG/WebP where supported, a bad/oversized image and cancelled picker. No crash, phantom photo or leaking file path; warnings are bold red and actionable.
- [ ] On a narrow phone, Common Profile → (enabled) Dating details → Dating photos → (enabled) Friendship details → Friendship photos → Review flows in correct order. **Save & Next** only, no obsolete separate Save/Next action; Back/right-swipe may return; forward remains blocked until server-saved valid current step. No bottom-bar overlap or nonhittable buttons.
- [ ] With zero or one valid photo assigned to any enabled mode, Review/Continue remains locked. Two unique owner-READY photos per enabled mode unlock it; reusing the same two files across modes is allowed without reupload. Removing one or enabling a new incomplete mode immediately relocks readiness.
- [ ] Verify name, broad city, explicit gender, handle, mode-specific bio/intention/interests, photo selection and session survive app restart; no duplicate mode drafts or unsaved edit loss on Back.
- [ ] Verify independent Dating/Friendship **activation requests**: changes to identity, required text, selected modes or assigned photos invalidate/stall outdated requests. No auto-reactivation. Owner-safe previews never show DOB, email, IDs, precise location, storage paths or secret URLs.
- [ ] Confirm other accounts cannot retrieve the owner's private photos/previews; **public discovery is still disabled** (`discoveryEligible=false`), even when activation intent is `pending_trusted_locality`.
- [ ] Check Settings password, devices and logout still work. Test the normal, non-test app afterward to confirm its existing session and data were **not** reset by the isolated test runner.
- [ ] Confirm no real AWS, email-provider, paid service or payments action was taken.

## Final evidence to record in `docs/qa/EVIDENCE_LOG.md`

- Date, git commit/ZIP version, actual command, exit code, number of Flutter UI PASS checkpoints (must include 15), device model/Android major version, test package `com.example.uluv.p02isolated` and manual-check results.
- Do not paste auth tokens, OTP, passwords, `.env`, media bytes, private profile data, or personal Android identifiers. Redact email/UID/device serials from logs.
- Record native picker/manual PASS **only if the owner actually performed it**; a passing automated test does not prove native picker integration.
- Historical P01-1 standalone Android OTP automation was a local-development exception, **not a PASS**; P02 closeout cannot waive a production requirement.

**Closeout decision template:** `P02 CORE_FLOW_VERIFIED (LOCAL)` only after full verifier + manual checks + explicit owner acceptance. Otherwise `P02 PARTIALLY_VERIFIED` with identified unverified/failed gates. The next phase P03 may be prepared only after this gate is recorded, and P03 public visibility must be implemented independently with trusted locality and authorization.
