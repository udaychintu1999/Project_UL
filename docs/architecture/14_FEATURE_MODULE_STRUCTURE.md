# Simple, scalable project structure (U_Day-style)

**One Fastify API monolith, one Flutter client, one separate Admin web app; no microservices or Lambda required.** One feature group owns its routes/services/repository/schema in a small directory. Avoid gigantic flat files and unnecessary layers.

```
AGENTS.md
README.md
apps/
  api/
    src/
      app.ts, server.ts, config.ts, db.ts      # P00 bootstrap
      features/
        accounts/                              # P01, P02, P03
        dating/                                # P06–P08
        friendship/                            # P09
        wallet/                                # P04, P07–P09, P16
        chat/                                  # P05, P08, P15
        local/                                 # P10–P12
        media/                                 # P02+; local / approved dev AWS adapters
        moderation/                            # P13–P14
        notifications/                         # P15
      shared/                                   # auth, security, typed errors, IDs, DB utils
    tests/{unit,integration}/
  flutter_app/
    lib/
      main.dart
      features/{onboarding,profiles,discovery,dating,friendship,wallet,chat,local,settings}/
      shared/{api,models,widgets}/
    test/; integration_test/
  admin/                                        # P14 separate web UI
infra/local/                                    # Java DynamoDB Local; no Docker
scripts/{db,dev,verify,release}/                # default local only; no AWS-changing scripts
 docs/{product,architecture,implementation,manual,security,qa,handoff}/
```

Feature module rule: start with `routes.ts`, `service.ts`, `repository.ts`, `schema.ts` when useful; skip empty files or patterns until justified. Flutter: screen + controller/state + API service + models under the owning feature. Prefer a single source-of-truth for pair IDs, credit transactions, H3 R6 indexing, media parent permission and expiry. Keep 18 table ownership mapped in `docs/architecture/02_PHYSICAL_SCHEMA.md`.

Every slice D1 API+local DB, D2 connected Flutter, D3 workflow/retries, T1 unit/static, T2 actual Java DynamoDB Local/API, T3 UI/device/regression. Never ship backend-only work as full-slice completion.

Security: generated source and tests may read `.env.example`, not real `.env`; no logged sensitive headers/URL queries, no AWS real operations by agents/scripts. Changes delivered with updated docs/ and verified via `npm run test:portable` plus safe packaging.
