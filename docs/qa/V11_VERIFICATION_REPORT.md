# v1.1 QA verification — Java Local & late integrations

**Date:** 2026-11-10  
**Scope:** Updated scripts, docs, 18-phase structure and local provisioning endpoint protection. **Not application runtime verification.**

| Check | Result | Evidence |
|---|---|---|
| Node 22 built-in domain unit tests | PASS, 5 tests | `npm run test:portable` |
| Source contract | PASS | `npm run test:portable` |
| 18 phases with D1–D3/T1–T3; 18 table catalog | PASS | `npm run test:docs` |
| Java-only startup + late integration gating | PASS (source assertions) | `npm run test:environment` |
| `npm run verify:p00` | PASS portable | Recorded output |
| Changed `.mjs` syntax | PASS | `node --check` |
| Windows PowerShell AST parser | UNVERIFIED | `pwsh` / Windows PowerShell absent; script supplied `scripts/verify/check-powershell-syntax.ps1` |
| DynamoDB Local Java JAR real CRUD/provision | UNVERIFIED | JAR absent in authoring environment; user runbook supplied |
| Real API + DB runtime | UNVERIFIED | Dependencies/local DB were not installed or booted |
| Flutter UI/widget/E2E | UNVERIFIED | SDK/emulator absent |
| AWS production DynamoDB/S3/ECS | NOT APPLICABLE, P17 | No owner authorization or AWS account used |
| Google Play Billing / payment gateway / Apple StoreKit | NOT APPLICABLE, P16 / later iOS | No store credentials or sandbox used |

The local JAR binaries are deliberately not shipped. All cloud/merchant secrets are excluded. This does not advance P00 verification status.

See `docs/qa/ARCHIVED_V11_PORTABLE_TEST_OUTPUT.md` for exact executed terminal output. For Windows manual checks see `docs/manual/JAVA_DYNAMODB_LOCAL_SETUP.md` and `scripts/verify/check-powershell-syntax.ps1`.
