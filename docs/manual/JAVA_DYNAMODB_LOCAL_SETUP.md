# DynamoDB Local — owner-operated Java startup on Windows (NO Docker)

This is the authoritative P00–P16 Java DynamoDB Local installation guide. **You manually start and stop the database every development session.** U_luv npm commands **never** start/stop Java or Docker; they only create/verify local tables and run the application/tests. For the complete commands, read `docs/manual/LOCAL_START_AND_VERIFY.md`.

## Install once

1. Install Java **17+** (`java -version`), Node **22+** (`node --version`), and Flutter/Android tools if using the mobile UI.
2. Download **the complete official DynamoDB Local archive** from https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.DownloadingAndRunning.html .
3. Extract the JAR with its adjacent `DynamoDBLocal_lib/` folder. You may use `.local/tools/dynamodb-local/` in this repository (ignored) or any external folder; no Docker Desktop is required.
4. From U_luv project root, run `npm install` then **`npm run env:init` once**. The owner-only generator copies `apps/api/.env.example` to the ignored `apps/api/.env` and installs a random private P00 token. **Do not share or inspect private `.env` in an AI session.** Already-configured files are preserved/refused rather than overwritten.

## Start DynamoDB Local manually, every session

Use PowerShell or Command Prompt in the **folder where you extracted `DynamoDBLocal.jar`**. Create the persistent folder once and then run:

```powershell
New-Item -ItemType Directory -Force -Path 'C:\Temp\uluv-ddb-data' | Out-Null
java "-Djava.library.path=./DynamoDBLocal_lib" -jar DynamoDBLocal.jar -sharedDb -dbPath "C:\Temp\uluv-ddb-data" -port 8000 -disableTelemetry
```

Java keeps this terminal occupied. Keep it open while using the API; stop with **Ctrl+C**. `-sharedDb` and `-dbPath` preserve the same data between sessions (avoid `-inMemory`). If you use an alternate port, edit `DYNAMODB_ENDPOINT` *privately* in `apps/api/.env` so API/provision/test scripts point to that port. Remote database URLs and real AWS are rejected.

## Start U_luv in other terminals (from project root)

```powershell
npm run db:provision   # only after Java is listening: creates/verifies 18 LOCAL tables
npm run dev:api        # stays running; Fastify localhost:3000
```

For Android Flutter, first use `npm run flutter:setup` (once), then `npm run dev:flutter`. The emulator reaches your host loopback through `http://10.0.2.2:3000`. Keep `APP_HOST=127.0.0.1`; P00 intentionally rejects public binds. For USB devices, run `adb reverse tcp:3000 tcp:3000` and `npm run dev:flutter -- --api-base-url http://127.0.0.1:3000`.

After Java and API are running, use `npm run test:db`, `npm run test:integration` and `npm run verify:p00` for full automated validation (Flutter/Android required). Run `npm run verify:p00:portable` for offline-only checks. All are local-only; the full gate refuses to declare success if dependencies or live services are unavailable.

## Troubleshooting

| Problem | Response |
|---|---|
| `Docker CLI missing` | Obsolete v1 scripts. This Java-only flow uses **no Docker** |
| `DynamoDBLocal.jar` not found | Switch directory to the archive folder containing the JAR **and** `DynamoDBLocal_lib` |
| `java` not recognized | Install Java 17+ and update PATH, restart terminal |
| `EADDRINUSE` on 8000 | Stop the existing Java process or choose another port and set the local endpoint privately |
| 18 tables not present / ready is 503 | `npm run db:provision` after Java has started |
| Every Flutter diagnostic shows connection error | Start `npm run dev:api`, keep API at `127.0.0.1:3000`; use emulator `10.0.2.2` or USB `adb reverse` |
| Data disappears after restart | Keep the same `-dbPath` and avoid in-memory mode |

No AWS, external cloud storage, payments, S3 tests or production table creation are performed by these commands. P16/P17 integrations require separately approved owner actions.
