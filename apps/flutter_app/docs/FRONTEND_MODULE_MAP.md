# U_luv — Flutter Frontend Module Map

The source uses feature ownership rather than a large generic `utils.dart` file. Keep the boundaries stable during P02 development.

| Module | Responsibility | Review for |
|---|---|---|
| `lib/main.dart` | App boot and P00 diagnostic entry wiring | Real app uses persistence gate; no P00 navigation from authenticated home |
| `lib/diagnostics_service.dart` | Local-only P00 readiness/DB roundtrip | Loopback-only guard, safe errors, no raw exceptions |
| `lib/features/auth/auth_screen.dart` | Signup, OTP, password, recovery and account UI | Distinct modes, inline guidance, field clearing, mounted state |
| `lib/features/auth/auth_service.dart` | Typed auth responses and P01-2 HTTP methods | Endpoint allowlist, privacy-safe messages, no transport leaks |
| `lib/features/auth/persistent_session.dart` | Session state machine, sealed record schema, device HTTP adapter | Single-flight refresh, token rotation, logout before late refresh, offline recovery |
| `lib/features/auth/persistent_gate.dart` | App startup restore gate and device management UI | No signed-in data before backend validation, device revocation |
| `android/app/src/main/kotlin/com/example/uluv/MainActivity.kt` | Native Keystore signing + encryption via MethodChannel | Non-exportable keys, AES-GCM, error redaction, channel compatibility |
| `test/` | Pure parsing and Flutter widget regressions | Match field keys/messages and current P01 contracts |
| `integration_test/` | Physical-device workflows | No local-outbox or device-test fixture bypasses in real production |
| `tool/flutter-workflow.mjs` | Developer commands using existing Dart/Flutter SDK | Strict allowlist and no alternative device-network launcher |

## Lifecycle

```text
main() -> UluvApp(persistentMode:true)
  -> PersistentAuthGate
    -> PersistentSessionController.restore()
      -> AndroidDeviceVault.read() -> signed device proof -> Fastify
      -> authenticated: AuthScreen(initialToken, accountExtra)
      -> offline: retry + signed-out option (do not delete credentials)
      -> invalid/no record: AuthScreen(sign-in)

Interactive login -> P01-2 AuthScreen -> session.enroll()
  -> server device slot + protected vault.write() -> authenticated

Refresh -> single-flight -> signed device proof -> atomic server rotation
  -> securely write rotated record -> new short access token

Logout -> seal signedOut flag -> server family revocation -> clear sealed record
```

The diagram describes existing intent, not a request to add methods or change backend behavior.
