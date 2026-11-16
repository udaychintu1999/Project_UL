# P02-2 final Continue interaction — Windows retest

1. Apply the update-only repair ZIP at project root. Preserve local `.env`, the Java DynamoDB Local data and all Android login state.
2. Start DynamoDB Local **manually**, run `npm run dev:api` in a separate terminal, and connect the USB Android phone.
3. Run `npm run verify:p02-2:portable`, `npm run typecheck`, `npm run lint` and `npm run test:flutter`.
4. Run `npm run test:flutter:p02-2:ui:e2e`. The test must emit the **13th checkpoint** and `All tests passed!` to count as success.
5. Verify the normal app still has its saved login. The test runner must touch only `com.example.uluv.p02isolated` and uses `--no-uninstall` to protect the base application.
6. Manually test the real Android system photo chooser, including a cancel action. The automated UI test substitutes only the chooser's returned image bytes, never the profile service or backend.

**If checkpoint 13 fails:** Do not change the two-photo requirement. Inspect any hit-test warning, the Scrollable/NavigationBar layout at the actual device size, and the real completion-screen transition. Capture and share the failure; no automated pass may be claimed.
