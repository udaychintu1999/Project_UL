# P01-3 — Approved Android Device Binding and Server Key Rotation (V3)

**Status:** approved security design, unimplemented. Use Android native Keystore via a narrow Flutter platform abstraction; only pinned/vetted dependencies and local tests. Keep raw keys and actual `.env` outside documentation, ZIPs and AI context.

## 1. Android installation key

1. On new interactive login, provision a **non-exportable asymmetric signing key pair** inside Android Keystore, preferably P-256 ECDSA/SHA-256 for broad Android device compatibility. The public SPKI key and a versioned alias fingerprint are safe enrollment data; the private key never leaves Keystore (no private key serialization to Flutter, SharedPreferences or server).
2. Bind the server-created session family to the enrolled public key after a server-verified password or OTP proof. Also prove possession of the private key by signing a clearly domain-separated enrollment request; reject enrollment if signing fails.
3. For refresh, sign a canonical byte string containing operation name, API path, family locator, request digest, nonce and protocol version. Verify signature against the server-registered public key **before** CAS. Accept strictly one family public key until explicit fresh interactive re-enrollment; do not let a refresh request silently rotate the device public key.
4. Hardware-backed Keystore/StrongBox should be used **if available**, but some legitimate phones only have software-backed non-exportable keys. Document observed security level, avoid false claims of universal hardware security; do not unnecessarily block supported devices without a separate minimum-device policy.
5. Ordinary app open/refresh must **not** require biometric prompt or device credential every 30 minutes; this would undermine the user-approved convenient 30-day experience. Enforce additional recent interactive authentication for sensitive server-side changes, not via routine key access prompts.
6. Store only the **single active renewal credential** and non-secret family/version metadata in protected, encrypted Android storage. Access bearer token stays memory-first. Prefer one versioned record, fully written before switching session state to active. No plaintext fallback when platform encryption throws.
7. Android backup and data transfer must **exclude** all auth storage blobs, alias metadata and local revocation-intent records as appropriate. Reinstall/data wipe/key loss must show normal sign-in. Backup cloning must never authorize another device, even if encrypted ciphertext is copied.
8. Device identifier means per-installation random server locator and optional friendly label; do not use IMEI, Android ID, raw hardware fingerprints or precise location as authorization.

## 2. Server key-purpose isolation

Separate secrets/key derivations for: access-token lookup digest; refresh-token lookup digest; OTP/purpose hashes already present; email/identity pseudonymization; any device-proof request MAC if needed. Prefer HKDF/domain-separated derivation from a root held by the owner or independently generated keys; **never concatenate fixed labels onto raw user passwords**, never share the P00 development token as a long-term signing root. Each stored digest includes a non-secret key version/kid.

- Key generation and secret values are **owner-operated**. AI/scripting may produce `.env.example` variable names, never read existing `.env`, real Keystore or private keys.
- Rotation protocol: introduce new key version, allow old/current *verification* for a **bounded migration window**, write only new key version for new credentials, migrate active family digests by authenticated refresh or require reauthentication, then retire old key only after a verified cutoff. If security incident suspected, force revocation/fresh login instead of indefinite old-key acceptance.
- Rotation must not accidentally convert a 401 into a 503, leak stored digests, or allow fallback to insecure default keys. Missing/invalid local secrets must fail closed at startup (not fall back to AWS).
- Do not use version metadata as secret. Log at most safe event ID, family hash prefix or pseudonym, credential generation and categorical outcome; no raw bearer, refresh, signatures, OTP, passwords, signing keys or full private identifiers.

## 3. Device-loss and installation failure matrix

| Condition | Result |
|---|---|
| App closed / OS kills process / reboot | Keystore signing still works; restore using protected renewal secret, after server check |
| No hardware-backed security | Use platform non-exportable Keystore key if policy allows; record capability, don't falsely reject without decision |
| App restored from other device | Renewal blob absent or signer mismatches -> fresh sign-in; no silent cloning |
| Keystore key invalidated | Clear unusable local auth, show recoverable sign-in; consider remote revocation on next authenticated opportunity |
| Encrypted store fails to read/write | No plaintext; do not claim durable login; prompt sign-in or retry as appropriate |
| Phone stolen, session revoked from another device | Server denies family, even if old access is still within 30-minute TTL |
| Server crypto key version retired | Reauthenticate if no valid migration; never silently accept unverifiable old digest |
| User explicitly signs out | Persist local signed-out state before any outstanding refresh completes; revoke family server-side |

## 4. Android/QA gates

- Verify native key cannot be exported through the supported platform APIs; sign/verify real messages on physical phone.
- Verify corrupt data, secure-store write failure and KeyStore alias loss produce clear states and no crashes.
- Verify backup/restore and phone reboot under the actual Android SDK/Gradle/plugin pinned versions.
- Verify two devices cannot use the same stolen refresh string with different Keystore signatures.
- Verify private keys and all `.env` values are excluded from the delivery ZIP, logs and source control.
- Record exact Flutter/Dart/Android toolchain versions in QA. Do not automatically run `flutter upgrade` because a banner is displayed.

**Standards boundary:** Device-bound proof improves persistence safety, but does not automatically certify U_luv to NIST or OAuth. For production, require TLS, secret management and independent security review under the appropriate authorized phase.
