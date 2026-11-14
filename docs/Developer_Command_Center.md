# CURRENT AUTHORITATIVE CHECKPOINT — P01-3 OWNER-ACCEPTED (2026-11-14)

**P00:** `CORE_FLOW_VERIFIED` (historical owner evidence). **P01-1:** manually accepted; its standalone Android OTP automation remains **FAILED**, explicitly accepted for *local development only* (never report PASS or production waiver). **P01-2:** owner-accepted after Windows automated and manual testing. **P01-3:** **OWNER-ACCEPTED for local development** after complete `npm run verify:p01-3` automated pipeline PASSED on Windows/physical Android and the owner reported that final manual phone testing worked as expected. **P02:** NOT STARTED; next is P02 specification/design review, not automatic authorization to implement.

**Evidence:** `docs/qa/P01_3_OWNER_ACCEPTANCE_2026_11_14.md` (current) and historical `docs/qa/P01_3_INITIAL_IMPLEMENTATION_EVIDENCE_2026_11_14.md`. A real 30-day elapsed-time field observation and production/security/provider readiness have **not** been demonstrated by these logs; automated 30-day boundary tests passed. Do not equate owner acceptance of local development with production release. Java DynamoDB Local remains the database through P16; no AWS/email-provider/payments integration is authorized by this acceptance. Earlier status blocks below are preserved as dated history, not current instructions.

---

# U_luv — Developer Command Center & Local Runbook

> **Notion reference · Updated 13 November 2026 · Windows + Android (USB)**  
> **Project:** U_luv — Algorithm-Free Connections  
> **Current status:** **P00 `CORE_FLOW_VERIFIED`** · **P01 `ON HOLD` (do not start without explicit approval)**  
> **Development stack:** Flutter (Android-first) ↔ Fastify/TypeScript ↔ Java DynamoDB Local  
> **Important:** DynamoDB Local is started and stopped **manually**. The npm commands do **not** start Java or Docker.

---

## ⭐ At a glance — the commands I use most

All `npm` commands run from the **U_luv project root**, not from `apps/api` or `apps/flutter_app`.

| When | Command | Purpose |
|---|---|---|
| New checkout — once | `npm install` | Install Node dependencies |
| New checkout — once | `npm run env:init` | Create private `apps/api/.env` with a generated development token; preserves an existing file |
| New checkout — once | `npm run flutter:setup` | Generate missing Android scaffold and fetch Flutter dependencies |
| Every session — manual | `java ... -jar DynamoDBLocal.jar ...` | Start DynamoDB Local yourself; full command below |
| After database starts | `npm run db:provision` | Create/verify the 18 local tables and P00 sentinel; safe to rerun |
| Every session — API terminal | `npm run dev:api` | Run Fastify on `127.0.0.1:3000`; leave running |
| Every session — phone terminal | `adb devices` | Check USB-debugging authorization |
| Every session — phone terminal | `npm run dev:flutter` | Run the Flutter app on USB Android; launcher sets up ADB reverse |
| Quick portable checks | `npm run verify:p00:portable` | Node/source/security checks; no live database required |
| Full P00 regression | `npm run verify:p00` | Requires live Java DB, Fastify, Flutter SDK and Android device |

**Everyday order:** **DynamoDB Local → provision tables (when needed) → Fastify → USB phone/Flutter → optional tests**. Keep the Java, API and Flutter terminals open while developing.

---

## 1. Very first setup — new PC or new checkout (one time)

### 1.1 Required software

- **Node.js 22+** and npm.
- **Java 17+** for the official DynamoDB Local JAR.
- **Flutter SDK**, Android SDK platform tools (`adb`), and Android development tooling.
- A physical Android phone with **Developer options → USB debugging** enabled (recommended; emulator is optional).
- The **official DynamoDB Local archive**, including both `DynamoDBLocal.jar` and the adjacent `DynamoDBLocal_lib/` folder; **Docker is not required**.

Official database download: <https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.DownloadingAndRunning.html>

Check the installations from a fresh terminal:

```powershell
node --version
npm --version
java -version
flutter --version
flutter doctor -v
adb version
```

### 1.2 Open the project root

For example, in **Windows Command Prompt (cmd)**:

```bat
cd /d C:\Dump\Projects\Project-ULuv-Space
```

Or in **PowerShell**:

```powershell
Set-Location 'C:\Dump\Projects\Project-ULuv-Space'
```

Use your actual folder if different. All subsequent `npm run ...` commands assume this root folder.

### 1.3 Initialize dependencies and local configuration

```powershell
npm install
npm run env:init
npm run flutter:setup
```

- `env:init` automatically creates the **private, Git-ignored** `apps/api/.env` from `apps/api/.env.example`, generates a local diagnostic token and **never prints the token**.
- If `.env` already exists, the initializer **keeps it unchanged**. Do not delete or recreate your working file for normal startups.
- `flutter:setup` generates missing Android native files (only if absent) and runs Flutter dependency resolution. Do not rerun `flutter create .` manually just to make Windows/web work; this project currently targets Android.
- Repeat `npm install` after package dependency changes; repeat `flutter:setup` only when setting up a new checkout or repairing Flutter dependencies.

### 1.4 Install DynamoDB Local (once)

Extract the official archive either to `.local/tools/dynamodb-local/` inside your project (ignored by Git), or to a separate local folder. **Keep `DynamoDBLocal.jar` beside `DynamoDBLocal_lib/`.** Choose a **persistent database data folder** such as `C:\Temp\uluv-ddb-data`, and reuse it every time.

---

## 2. Everyday startup — Windows + physical Android over USB

Use **three or four separate terminal windows**. These instructions assume the default ports **8000** for DynamoDB Local and **3000** for Fastify.

### Terminal 1 — start DynamoDB Local manually

**Open a PowerShell terminal inside the directory containing `DynamoDBLocal.jar`.** Create the persistent storage directory if it doesn't exist:

```powershell
New-Item -ItemType Directory -Force -Path 'C:\Temp\uluv-ddb-data' | Out-Null
```

Then start Java:

```powershell
java "-Djava.library.path=./DynamoDBLocal_lib" -jar DynamoDBLocal.jar -sharedDb -dbPath "C:\Temp\uluv-ddb-data" -port 8000 -disableTelemetry
```

For **Command Prompt (cmd)**, create the directory with:

```bat
if not exist "C:\Temp\uluv-ddb-data" mkdir "C:\Temp\uluv-ddb-data"
```

Then run the same `java` command from the JAR directory.

**Leave this terminal running.** `-dbPath` plus `-sharedDb` persists your database on disk. **Do not add `-inMemory`** or change to a different data folder unintentionally. Stop with **Ctrl+C** when finished.

### Terminal 2 — provision database and start Fastify

Open a **new terminal at project root**:

```powershell
npm run db:provision
npm run dev:api
```

- `db:provision` creates or verifies all **18 canonical `uluv_` tables** and writes the P00 readiness sentinel. It does **not** start DynamoDB Local or contact real AWS.
- On later days, provisioning is usually unnecessary if the same persistent database is intact, but it is **safe to rerun** to verify the tables and sentinel.
- `dev:api` keeps Fastify running at **`http://127.0.0.1:3000`**. Leave this terminal open.

Optional local health checks, using your PC browser:

- [API is alive](http://127.0.0.1:3000/health/live) — expect an `ok` response when Fastify is running.
- [Database is ready](http://127.0.0.1:3000/health/ready) — expect `database: connected` when DynamoDB Local and its sentinel are available; database outage should produce HTTP 503.

### Terminal 3 — run Flutter on the USB-connected phone

1. On your phone, enable **Developer options → USB debugging**.
2. Connect a data-capable USB cable and **approve this computer** on the phone.
3. In another terminal at project root:

```powershell
adb devices
flutter devices
npm run dev:flutter
```

The phone should appear as **`device`**, not `unauthorized`. The Flutter launcher automatically invokes the equivalent of:

```powershell
adb reverse tcp:3000 tcp:3000
```

This makes **the phone's `127.0.0.1:3000` reach Fastify on your PC**. **The phone and PC do not need the same Wi-Fi**, and **you do not need your PC's LAN IP address**. Keep Fastify bound to localhost for safety.

The app's **Check server** and **Test database** buttons are P00 diagnostic features. When the database is unavailable, the app should show an error; after restarting the database, retries should work.

### Terminal 4 — run tests when necessary

```powershell
npm run typecheck
npm run test:db
npm run test:integration
npm run test:flutter
npm run test:flutter:e2e
```

To execute all automated P00 gates in their configured order, use:

```powershell
npm run verify:p00
```

The full verifier is optional during an ordinary editing session, but useful after code/config changes. It requires a working DB, a **running Fastify process in another terminal**, and a connected Android device or emulator.

---

## 3. USB versus emulator — one config file

**File:** `apps/flutter_app/dev_connection.config.mjs`  
This is a **non-secret** configuration file; do not put tokens or real credentials in it.

```javascript
export const localFlutterConnection = Object.freeze({
  target: 'usb', // 'usb' = real phone via ADB reverse; 'emulator' = Android Studio emulator
  usbApiBaseUrl: 'http://127.0.0.1:3000', // physical Android USB
  emulatorApiBaseUrl: 'http://10.0.2.2:3000', // Android Studio emulator
  deviceId: '', // optional ADB device serial; blank for one phone
});
```

| Mode | Target | API URL used inside Android | Special requirement |
|---|---|---|---|
| **USB phone (default)** | `usb` | `http://127.0.0.1:3000` | Authorized ADB connection; reverse forwarding is automatic |
| Android Studio emulator | `emulator` | `http://10.0.2.2:3000` | Running Android emulator; no ADB reverse required |

**Temporary CLI override**, without editing the file:

```powershell
npm run dev:flutter -- --target usb
npm run dev:flutter -- --target emulator
```

If more than one device is connected:

```powershell
npm run dev:flutter -- --device YOUR_ADB_SERIAL
```

Emulator integration test:

```powershell
npm run test:flutter:e2e -- --target emulator
```

You can also use a local override such as `--api-base-url http://127.0.0.1:3000`. The launcher only permits approved local/emulator HTTP hosts; **public IPs, LAN IPs and remote HTTPS endpoints are intentionally blocked in P00**. An existing `ULUV_API_BASE_URL` environment override takes precedence over the config, so remove an obsolete override if changing targets doesn't seem to work.

If you change the Fastify port from `3000`, update the matching connection URL in this config and reconnect forwarding.

---

## 4. `.env` — what exists and what it means

**Private file:** `apps/api/.env`  
**Shareable template:** `apps/api/.env.example`

The normal way to create your private file is **`npm run env:init` once**. The following table is a **reference for keys and defaults**, **not a copy of your real secret file**:

| Setting | Local default / meaning |
|---|---|
| `APP_ENV` | `local` — P00 local environment |
| `APP_HOST` | `127.0.0.1` — **do not change to `0.0.0.0`** |
| `APP_PORT` | `3000` — Fastify listen port |
| `AWS_REGION` | `ap-south-1` — AWS SDK configuration even when talking to the local emulator |
| `DYNAMODB_ENDPOINT` | `http://127.0.0.1:8000` — manually started Java DynamoDB Local |
| `AWS_ACCESS_KEY_ID` | `local` — dummy SDK value, **not** a real AWS key |
| `AWS_SECRET_ACCESS_KEY` | `local` — dummy SDK value, **not** a real AWS key |
| `ULUV_DEV_TOKEN` | Privately generated by `env:init`; never paste, log or distribute it |
| `MEDIA_STORAGE_DRIVER` | `local` — cloud media disabled by default |
| `MEDIA_ENV` | `development` |

**Important:** The launcher uses the local diagnostic token to run the Flutter debug app (via `--dart-define`), meaning it can be embedded in that debug build. **Never distribute the P00 debug APK, upload the token to Notion, or use it as a production credential.** Do not paste your actual `.env` into chats, issues, screenshots or ZIP archives.

---

## 5. Complete npm command reference

These are **real scripts in the current root `package.json`**:

### Setup and development

| Command | Function |
|---|---|
| `npm install` | Install npm dependencies |
| `npm run env:init` | First-time owner-only `.env` initialization; preserves existing file |
| `npm run flutter:setup` | Prepare Android Flutter scaffold/dependencies |
| `npm run db:provision` | Verify/create 18 local DynamoDB tables and sentinel |
| `npm run dev:api` | Start Fastify development server |
| `npm run dev:flutter` | Run Flutter on configured device (USB by default) |

### Tests, quality and security

| Command | What it checks | Needs live DB/API/phone? |
|---|---|---|
| `npm run test:unit` | Backend business rules and local-safety unit tests | No |
| `npm run test:local-guards` | Rejection of unsafe database/endpoint URLs | No |
| `npm run test:dev-cli` | Flutter launcher and device-argument negative tests | No |
| `npm run test:env-init` | Safe/idempotent `.env` initialization tests using synthetic fixtures | No |
| `npm run test:contracts` | API/Flutter source contracts | No |
| `npm run test:docs` | Required documentation and schema contracts | No |
| `npm run test:environment` | Local environment and integration policy checks | No |
| `npm run test:secrets` | Offline source/document secret scanner | No |
| `npm run test:cloud-guards` | Cloud-operation safety checks | No |
| `npm run test:portable` | All portable tests/guards above | No |
| `npm run verify:p00:portable` | Alias for portable-only verification | No |
| `npm run typecheck` | Fastify backend TypeScript typechecking | No (npm dependencies required) |
| `npm run test:db` | Real DynamoDB Local schema + conditional Put/Get/Query/Delete | **DB** |
| `npm run test:integration` | Running Fastify, authentication rejection, concurrent DB roundtrips | **DB + API** |
| `npm run test:flutter` | Flutter static analysis and widget tests | Flutter SDK; **no phone needed** |
| `npm run test:flutter:e2e` | Real Android → Fastify → DynamoDB Local integration | **DB + API + Android** |
| **`npm run verify:p00`** | Complete automated P00 gate, all applicable tests in sequence | **DB + API + Android** |

**Do not confuse:** portable-test success with end-to-end success. The full gate has already passed on the owner's Windows PC with a USB Android phone; repeat it when relevant files change.

---

## 6. Stopping and restarting safely

**Stop:** Flutter terminal (`q` in `flutter run` or Ctrl+C), Fastify terminal (**Ctrl+C**), then Java DynamoDB Local terminal (**Ctrl+C**). Close the corresponding terminals after processes have exited.

**Next day:** Start Java again with the **same `-dbPath`**, start Fastify, connect/authorize USB phone, and run Flutter again. Rerun `db:provision` whenever you need to verify tables or restore the P00 sentinel; it is safe to repeat.

**When DynamoDB goes down:** Fastify can remain live, but its DB readiness should become unavailable and the Flutter database test should show a failure. Restart Java with the same persistent folder, then try both buttons again. **This outage/recovery was observed successfully during P00 acceptance on 13 November 2026.**

---

## 7. Troubleshooting — fast solutions

| Symptom | Most likely fix |
|---|---|
| `.ps1` opens in an editor | Use the standardized **npm commands**, not `node some-script.ps1` |
| `npm run env:init` reports existing file | **Normal:** leave the private `.env` unchanged |
| `.env` is missing on a new checkout | From root, run `npm run env:init` once |
| `Cannot find module`, `tsx` missing | Run `npm install` in the project root |
| Java command cannot find `DynamoDBLocal.jar` | `cd` into its actual extracted folder; keep `DynamoDBLocal_lib/` alongside the JAR |
| `ECONNREFUSED 127.0.0.1:8000` | Start DynamoDB Local Java process on port 8000 |
| `ECONNREFUSED 127.0.0.1:3000` | Start `npm run dev:api` and leave that terminal running |
| `/health/live` OK but `/health/ready` unavailable | Check Java DB on 8000; rerun `npm run db:provision` if the sentinel is missing |
| Android device `unauthorized` | Unlock phone, approve USB debugging authorization, then `adb devices` |
| Flutter says no supported devices | Connect USB Android or launch emulator; confirm `flutter devices` lists **Android** |
| USB phone cannot reach API | Check `adb devices`, Fastify on port 3000 and `target: 'usb'`; rerun `npm run dev:flutter` to recreate ADB reverse |
| Emulator cannot reach API | Use `--target emulator` and `10.0.2.2:3000`; don't use emulator `localhost` for the host PC |
| Multiple Android devices | Specify `--device YOUR_ADB_SERIAL` |
| Table data seems gone after restarting Java | Verify you reused the **same `-dbPath`** and didn't use `-inMemory` |
| Port 8000 or 3000 already in use | Stop the duplicate process or consistently change the relevant local config/ports |
| Flutter/Gradle warns about restricted native access | Warning was **nonfatal** in the successful P00 Android test; revisit when upgrading Java/Gradle |
| `npm run verify:p00` fails on E2E | Ensure Java DB, Fastify and Android device are all running before rerunning; portable-only check is `npm run verify:p00:portable` |

---

## 8. Database naming and data safety

There are **18 local DynamoDB tables**, all sharing the prefix **`uluv_`**:

| | | |
|---|---|---|
| `uluv_users` | `uluv_auth_links` | `uluv_profiles` |
| `uluv_settings` | `uluv_discovery` | `uluv_dating_likes` |
| `uluv_dating_matches` | `uluv_friendship_requests` | `uluv_connections` |
| `uluv_blocks` | `uluv_wallet` | `uluv_local_posts` |
| `uluv_activities` | `uluv_local_comments` | `uluv_local_reactions` |
| `uluv_chat` | `uluv_safety` | `uluv_operations` |

The canonical table definitions live in `docs/architecture/TABLE_CATALOG_v0_3.json`. Do not rename tables, add scans/GSIs, or change the 18-table model without an approved architectural decision. `uluv_operations` contains the P00 diagnostic sentinel.

**Local DB storage:** The location is whatever persistent path you select with Java's `-dbPath` (example: `C:\Temp\uluv-ddb-data`). It is **not automatically stored in the U_luv project root**.

---

## 9. Security, deployment boundaries and project status

- **P00 = `CORE_FLOW_VERIFIED`** (13 November 2026). Evidence: owner's successful full `npm run verify:p00` output; 23 portable Node tests; passing TypeScript; all 18 local DB tables/operations; API integration; 7 Flutter widget tests; USB Android E2E; both on-phone diagnostic buttons; database-down error and successful restart/recovery.
- **P01 = `ON HOLD`**. Do **not** start P01, change architecture or expand the scope until the owner explicitly approves it. P01–P17 are not started.
- **No AWS DynamoDB for P00–P16:** Use Java DynamoDB Local for current development; real AWS DynamoDB staging/production tables are reserved for P17 with explicit approval.
- DEV S3/CloudFront resources are a separate, owner-approved future setup; the existence of a resource does not authorize scripts/agents to use it. Local media remains the default.
- Payments remain for later approved phases: P16 sandbox/planning, P17 production integration/release. No live payment or production cloud operations are authorized by this runbook.
- Keep Fastify bound to `127.0.0.1`; ADB reverse is the approved local-phone bridge. **Do not expose the P00 dev-token route on Wi-Fi/public networks.**
- Never upload `apps/api/.env`, private keys, AWS credentials, generated debug APKs or device/user data into Notion, Git, chats or handoff ZIPs.
- Previous P00 evidence files contain historical `PARTIALLY_VERIFIED` entries. **The newest closeout status supersedes those older entries.** The older local runbook header may still use the pre-closeout status; refer to the current closeout document below.

### Primary repository documentation

| Location | Why it matters |
|---|---|
| `README.md` | Project overview and quickstart |
| `AGENTS.md` | Engineering/agent working rules |
| `docs/START_HERE.md` | Required reading order |
| `docs/manual/JAVA_DYNAMODB_LOCAL_SETUP.md` | Manual Java installation/startup |
| `docs/manual/LOCAL_START_AND_VERIFY.md` | Detailed Windows development/testing instructions (older status in heading) |
| `docs/implementation/PROGRESS.md` | Latest phase progress at the top; older entries retained as history |
| `docs/qa/EVIDENCE_LOG.md` | Evidence provenance and outcomes |
| `docs/qa/P00_CLOSEOUT_2026_11_13.md` | **Authoritative P00 closeout and current verification status** |
| `docs/NEXT_STEP.md` | Latest next-step/hold decision at the top; older instructions are historical |
| `docs/implementation/PHASE_MASTER.md` | Phase ordering and scope |
| `docs/product/PRODUCT_CONTRACT.md` | Product behavior/invariants |
| `docs/security/00_NON_NEGOTIABLE_GUARDS.md` | Credential, cloud and cost safety rules |

---

## 10. Copy/paste daily checklist

- [ ] Start DynamoDB Local Java **manually**, using the existing persistent `-dbPath`.
- [ ] Open a project-root terminal and run `npm run db:provision` (optional on later sessions, recommended for verification).
- [ ] In that terminal, run `npm run dev:api` and **leave it open**.
- [ ] Connect and authorize Android USB; confirm `adb devices` shows `device`.
- [ ] Open another project-root terminal and run `npm run dev:flutter`.
- [ ] Use the Flutter app. Optionally run `npm run test:integration` or the complete `npm run verify:p00` in a fourth terminal.
- [ ] Before finishing, stop Flutter → Fastify → DynamoDB Local gracefully.
- [ ] **Do not start P01** unless explicitly authorized.

> **Remember:** On a normal day you do **not** need to run `npm install`, `npm run env:init` or `npm run flutter:setup` again. You only need the manually started database, running Fastify server and the connected Flutter device.
