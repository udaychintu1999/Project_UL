# P00 — Windows local start, npm commands and honest verification

**Current status (2026-11-13):** `CORE_FLOW_VERIFIED` based on owner-reported passing Windows and USB Android full-stack checks plus confirmed database-outage error and successful restart recovery. **P01 is now authorized and its first local-email OTP slice is partially verified.** See `docs/manual/P01_EMAIL_OTP_WINDOWS_TEST.md`; the original P00 run commands remain valid. **All commands below run from the project root** in PowerShell or Command Prompt, unless a `cd` is shown. Java DynamoDB Local is started and stopped **manually by the owner**. npm does not start/stop it. No Docker, AWS database, or payment service is used.

## A. First-time setup (once per checkout)

1. Install **Node.js 22+**, npm, **Java 17+**, and, for the mobile app, the **Flutter SDK + Android SDK/emulator**.
2. Place the official `DynamoDBLocal.jar` and matching `DynamoDBLocal_lib/` folder in `.local/tools/dynamodb-local/` or use an external install. Download it yourself via the [official AWS guide](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.DownloadingAndRunning.html). No Docker required.
3. From project root run:

```powershell
npm install
npm run env:init
```

`npm run env:init` is an **OWNER-ONLY** utility (previously `node scripts/dev/generate-token.mjs`). It creates the Git-ignored **`apps/api/.env`** from **`apps/api/.env.example`** and replaces `ULUV_DEV_TOKEN=REPLACE_...` with a randomly generated local token. It prints only a success message, **not the token**. You do not need to create `.env` manually. **Run once for a new checkout. If `.env` already exists, this command now reports that it was preserved and exits successfully without opening it.** If you intentionally created an incomplete `.env`, correct it privately using `.env.example`; never send its contents to a chat. Never upload/paste `.env` or the token into AI chat, tickets or ZIPs. Do not run `env:init` in CI/agents.

Default `.env.example` values are all for local development:

| Property | Local value / reason |
|---|---|
| `APP_ENV` | `local`; P00 rejects production |
| `APP_HOST` | `127.0.0.1`; loopback-only security guard |
| `APP_PORT` | `3000`; Fastify port |
| `AWS_REGION` | `ap-south-1`; SDK region for local requests |
| `DYNAMODB_ENDPOINT` | `http://127.0.0.1:8000`; manually started Java process |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | `local`; **dummy values**, never real AWS keys |
| `ULUV_DEV_TOKEN` | Generated privately by `npm run env:init`; protects debug roundtrip |
| `MEDIA_STORAGE_DRIVER` | `local`; disables cloud media operations |
| `MEDIA_ENV` | `development`; local configuration |

If you deliberately change the Java database port, **privately** update `DYNAMODB_ENDPOINT` in `apps/api/.env`. If port 3000 is in use, change `APP_PORT` and pass the matching local Flutter URL. Do not expose Fastify at `0.0.0.0` or use a remote database URL.

## B. Every development session — owner starts DynamoDB manually

**Terminal 1 — Java DynamoDB Local:**

```powershell
# Run inside the folder containing DynamoDBLocal.jar and DynamoDBLocal_lib/
New-Item -ItemType Directory -Force -Path 'C:\Temp\uluv-ddb-data' | Out-Null
java "-Djava.library.path=./DynamoDBLocal_lib" -jar DynamoDBLocal.jar -sharedDb -dbPath "C:\Temp\uluv-ddb-data" -port 8000 -disableTelemetry
```

The database terminal stays open. Use **Ctrl+C** to stop it. The `-sharedDb` database persists in the chosen data folder between sessions. For alternate install locations/ports, read `docs/manual/JAVA_DYNAMODB_LOCAL_SETUP.md`.

**Terminal 2 — project root, provision tables and start Fastify:**

```powershell
npm run db:provision
npm run dev:api
```

Provisioning creates/verifies the **18 LOCAL tables** plus P00 sentinel; reruns are safe. Provisioning uses `apps/api/.env` automatically and refuses remote endpoints. The Fastify process stays running at `http://127.0.0.1:3000` by default; open <http://127.0.0.1:3000/health/live> and <http://127.0.0.1:3000/health/ready> to check it. DB-backed readiness must return 503 when the Java process is down.

**Terminal 3 — Flutter (first boot setup only):**

```powershell
npm run flutter:setup
npm run dev:flutter
```

The setup command creates missing Android native scaffolding **only if absent** and runs `flutter pub get`. To run Android, **you must first launch an emulator or connect a phone**; Windows, Chrome and Edge appearing in `flutter devices` do not count as Android devices for this P00 starter.

To use an emulator on Windows, open Android Studio → **Device Manager** → **Create device** (if necessary) → choose an installed system image → **Start**. Or use CLI:

```powershell
flutter doctor -v
flutter emulators
flutter emulators --launch <emulator-id>  # replace with a listed emulator ID
flutter devices                           # should now list an Android device
npm run dev:flutter
```

If `flutter emulators` finds none, install Android Studio's Android SDK, emulator and system image using Device Manager. If using a USB Android phone, enable Developer options and USB debugging, connect/authorize the computer, and run `adb devices` to ensure it is listed. Do **not** use `flutter create .` to enable Windows/web; doing so expands the approved Android-first scope.

**Choose the connection in `apps/flutter_app/dev_connection.config.mjs`**, a checked-in *non-secret* file with explanatory comments for both phone and emulator. The default is **USB phone**:

```js
// In apps/flutter_app/dev_connection.config.mjs
// Default physical Android USB phone: launcher automatically runs adb reverse.
target: 'usb',
usbApiBaseUrl: 'http://127.0.0.1:3000',
// Android Studio emulator: set target: 'emulator' to select this URL.
emulatorApiBaseUrl: 'http://10.0.2.2:3000',
```

**Physical Android USB (recommended for low-RAM Windows PCs):** Enable Developer Options → USB debugging, connect a data-capable cable, approve the PC authorization prompt, then `adb devices`. The phone must show `device`, not `unauthorized`. With `target: 'usb'`, just run `npm run dev:flutter`. The npm launcher first runs `adb reverse tcp:3000 tcp:3000`, and the phone's `127.0.0.1:3000` reaches the PC Fastify server. **No same-Wi-Fi requirement and no computer LAN IP needed**. On multiple attached devices, specify `deviceId` in the config or run `npm run dev:flutter -- --device YOUR_ADB_SERIAL`.

**Android emulator:** change `target: 'emulator'` in the config or run `npm run dev:flutter -- --target emulator`. It uses `http://10.0.2.2:3000` automatically and does not run adb reverse. For device integration use `npm run test:flutter:e2e` (USB default) or `npm run test:flutter:e2e -- --target emulator`.

**Overrides/ports:** CLI `--api-base-url` overrides `ULUV_API_BASE_URL` environment variable, which overrides the config's target URL. If you set `ULUV_API_BASE_URL` in your shell or private env file, unset it to use the new config. If you privately change `APP_PORT` from 3000, update the port in the relevant URL. Only loopback hostnames or emulator `10.0.2.2` are allowed, and invalid URLs fail before token transmission. Keep `APP_HOST=127.0.0.1`. P00 intentionally disallows phone access through public/Wi-Fi LAN IPs; a secure, separately reviewed network design would be required before enabling that.

**API integration requirement:** Leave `npm run dev:api` **running in another terminal** before executing `npm run test:integration`. `ECONNREFUSED 127.0.0.1:3000` means Fastify is not listening (or a port mismatch), not that the 18 DynamoDB tables are missing. Check `http://127.0.0.1:3000/health/live` on your PC and then run `npm run test:integration` again.

This is a debug-only P00 diagnostic build. Flutter `--dart-define` embeds its local dev token in the app/test process; **never distribute the debug build or reuse the token for production**. Emulator `10.0.2.2` bridges to host loopback; keep Fastify on `127.0.0.1`.

## C. Verification in a separate project-root terminal

| Command | Meaning |
|---|---|
| `npm run test:portable` or `npm run verify:p00:portable` | Offline unit, CLI negative, contract, docs, environment, secrets and cloud safety checks; **does not prove live integration** |
| `npm run typecheck` | Real Fastify/TypeScript compilation check |
| `npm run test:db` | All 18 real DynamoDB Local schemas and direct conditional Put/Get/Query/Delete |
| `npm run test:integration` | Real running Fastify → DynamoDB Local, invalid token, concurrent operations |
| `npm run test:flutter` | Flutter analyze + widget tests (SDK required) |
| `npm run test:flutter:e2e` | Actual Android device/emulator Flutter → Fastify → DynamoDB Local test |
| **`npm run verify:p00`** | **Full automated gate**, runs all the above sequentially, fails if any are missing or fail |

**Important:** `verify:p00` no longer gives a portable-only green result; it requires the manually started database, running API, installed SDKs and a configured emulator/device. The owner subsequently reported a successful full automated gate and manually confirmed the database-unavailable error during outage and normal app operation after restarting DynamoDB Local. This evidence is recorded under `CORE_FLOW_VERIFIED`. Rapid repeated-tap and post-restart database reruns are optional supplementary checks that have not been separately evidenced. If you only want offline checks, use `npm run verify:p00:portable`.

## D. Human acceptance and recovery (T2/T3)

1. Both Flutter buttons should show success **only** while API and real DynamoDB Local are running. Verify `Check server`, `Test database`, then retry; two quick taps cannot start duplicate in-flight work.
2. Stop Java manually with Ctrl+C. API `/health/live` remains 200, `/health/ready` returns **503**, UI shows an error on retry.
3. Restart Java manually with the same data folder, run `npm run db:provision` if needed, retry both Flutter buttons; success must recover without application reinstall.
4. Re-run `npm run db:provision` and `npm run test:db`, verify no table loss/schema drift; invoke `npm run test:integration` to test missing and wrong token plus concurrent requests.
5. Record redacted command results and screenshots (with no token/secret exposure) in `docs/qa/EVIDENCE_LOG.md` after actual execution. Do not mark tests PASS based on a script being present.

## E. Common troubleshooting

| Symptom | Action |
|---|---|
| `.ps1` file opens in Notepad/editor | **Use npm commands above** in cmd or PowerShell; do not run `node *.ps1` |
| `.env` missing / token not configured | Run **`npm run env:init` once** for a new checkout (owner only). If `.env` already exists, it is preserved; privately correct incomplete values using `.env.example` |
| `Cannot find module` / `tsx` missing | Run `npm install` from root |
| `ECONNREFUSED 127.0.0.1:8000` | Start Java DynamoDB Local manually in another terminal; check port 8000 |
| `ECONNREFUSED 127.0.0.1:3000` during `test:integration` | Fastify is not listening. In another terminal leave `npm run dev:api` running; check `/health/live`, then rerun the integration test |
| API `/health/ready` 503 | Run `npm run db:provision` after Java starts; check sentinel |
| Flutter missing / Android project not generated | Install Flutter/Android SDK, run `flutter doctor`, then `npm run flutter:setup` |
| Emulator cannot contact API | Emulator uses `http://10.0.2.2:3000`; server stays on `127.0.0.1` |
| USB device cannot contact API | Check `adb devices` says `device`, API is running, `target: 'usb'` in `dev_connection.config.mjs`, and Android SDK `adb` is on PATH. The launcher automatically runs `adb reverse`; choose `--device` if multiple targets. |
| `TS18046: 'error' is of type 'unknown'` in `apps/api/src/app.ts` | Apply the 2026-11-13 P00 fix ZIP (adds `instanceof Error` narrowing), then rerun `npm run typecheck` |
| `No supported devices connected` after `flutter:setup` | Start an Android Studio emulator or connect/authorize an Android phone; confirm `flutter devices` lists Android before `npm run dev:flutter` |
| `verify:p00` fails on Flutter/E2E | This is a **real verification blocker**, not a portable PASS; run `verify:p00:portable` for offline-only checks |

**Cloud and billing boundary:** DynamoDB Local through P16. No actual AWS database, cloud uploads, production media or payments authorized. Owner creates any future DEV S3/CloudFront resources separately. Real AWS DynamoDB tables and deployment require explicit P17 authorization; payment provider activity is independently gated.
