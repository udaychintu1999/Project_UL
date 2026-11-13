# Safe offline ZIP delivery

Run these **offline** from project root before packaging each slice:

```powershell
npm run test:portable
npm run test:secrets
npm run test:cloud-guards
```

If Python 3 is installed, create a complete archive:

```powershell
python scripts/release/package-safe.py --mode full --output ..\U_luv_Full_Developer_Handoff_SAFE.zip
```

For phase updates provide changed paths explicitly; the tool includes all updated `docs/` files:

```powershell
python scripts/release/package-safe.py --mode update --changed apps/api/src/features/example/service.ts apps/flutter_app/lib/features/example/screen.dart scripts/verify/example.mjs --output ..\U_luv_Pxx_Update.zip
```

Example paths only; replace with files actually modified. The packer refuses secret-bearing `.env`, keys, media, local Java DB, symlinks, oversized files and common credential patterns. It never reads ignored secrets and never contacts the network or AWS. It reports paths/rule codes only. Owner handles any real AWS/cloud setup manually, with explicit individual authorization per action before any agent operation. DO NOT weaken these checks to force a ZIP to build.
