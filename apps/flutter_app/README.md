# U_luv Flutter — P00 local-device diagnostics

**Connection setting:** edit `apps/flutter_app/dev_connection.config.mjs` (a plain commented JavaScript config, not a secret file). Switch `target` between `'usb'` (default) and `'emulator'`; update the corresponding URL only if your PC API port changes. Do **not** set a LAN/public IP, put tokens in this file or bind Fastify to `0.0.0.0`.

| Target | `target` | API URL inside Android | Setup |
|---|---|---|---|
| Physical Android phone, USB debugging | `'usb'` | `http://127.0.0.1:3000` | Connect/authorize phone; `adb reverse` is automatic in launcher |
| Android Studio emulator | `'emulator'` | `http://10.0.2.2:3000` | Start emulator; no reverse needed |

USB works without shared Wi-Fi. Phone localhost reaches PC localhost **only after successful `adb reverse`**. The npm launcher automatically runs `adb reverse tcp:3000 tcp:3000` for a localhost URL. `adb` must be installed/on PATH and device must be authorized (`adb devices`). If there are multiple connected Android targets, set `deviceId` in config or supply `--device <flutter-device-id>` after `--`.

Run from project root (DynamoDB Local still started manually in another terminal):

```powershell
npm run db:provision         # once after starting DynamoDB Local; can be rerun safely
npm run dev:api              # KEEP THIS TERMINAL RUNNING
```

In another terminal:

```powershell
adb devices                 # physical phone should be listed as "device"
npm run dev:flutter         # default: USB; adb reverse automatic
npm run test:flutter        # Flutter analyze + widget tests (no device required)
npm run test:integration    # requires Fastify still running; real DB roundtrip
npm run test:flutter:e2e    # USB phone + Fastify + DynamoDB Local
```

To run on the Android Studio emulator **without changing the config file**:

```powershell
npm run dev:flutter -- --target emulator
npm run test:flutter:e2e -- --target emulator
```

You may also use `--api-base-url http://127.0.0.1:3000` or `--device <device-id>`. Only local debug endpoints are permitted, and CLI options never disable that guard. If you change `APP_PORT` in private `apps/api/.env`, change the URL port in `dev_connection.config.mjs` too. `ULUV_API_BASE_URL` if set in your local environment takes precedence over the config; remove it if you want the file to decide the mode.

The private development token is read from `apps/api/.env` by the launcher and embedded via `--dart-define` in the local debug build. **Never share this build or the token**. Do not edit Flutter source to paste credentials. P00 has no production authentication; real AWS/payment integration remains out of scope. Full instructions and failure/recovery checks: `docs/manual/LOCAL_START_AND_VERIFY.md`.
