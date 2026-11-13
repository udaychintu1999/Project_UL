# Historical upgrade notes — superseded

**FINAL v2.0 handoff is the only authoritative fresh extraction.** This document is retained for readers of prior v1.x projects; do not reapply old patches over v2.0.

# Upgrading an existing extracted v1.0 project to v1.1

The v1.1 update ZIP contains only changed root files, scripts, and a refreshed **docs/** folder. **It is NOT a standalone runnable repository**—apply it over your existing project root.

1. Save/commit your current project; do not overwrite your own `apps/api/.env`, media, local DB files or completed phase work without reviewing diffs.
2. Extract the **update-only** ZIP into the same project root. Review changed files if a coding agent has already modified them.
3. Remove the obsolete `infra/local/compose.yml` **only if it is the unmodified Docker Compose file from the v1.0 handoff**. No active script uses it; canonical full v1.1 ZIP omits it entirely.
4. Download/extract official Java 17+ DynamoDB Local JAR and native `DynamoDBLocal_lib` alongside the JAR, e.g. to `.local/tools/dynamodb-local` (ignored).
5. Run `npm install`, owner-only `npm run env:init`, **manually start Java DynamoDB Local**, `npm run db:provision`, `npm run dev:api`, `npm run dev:flutter` and the P00 local/API/Flutter verification commands in `docs/manual/LOCAL_START_AND_VERIFY.md`.
6. Confirm local configuration never points to remote AWS. Production AWS work and Google Play/gateway sandbox remain P16/P17.

**For a clean new repository**, extract the FULL v2.0 handoff instead. Use `docs/handoff/INITIAL_PROMPT_UNIVERSAL.md` for first session and `CONTINUE_PHASE_PROMPT_UNIVERSAL.md` afterward.

This migration changes the local database **startup runtime**, not the 18 DynamoDB table names/keys or the underlying credit/product rules. Old Docker local data is not automatically copied into the new Java SQLite database; keep test fixtures reproducible and rerun local table provisioning.
