# Flutter feature layout

One feature directory per workflow (onboarding/profiles/discovery/dating/friendship/wallet/chat/local/settings). Each contains the screen, simple controller/state, API service and models needed for the current slice. Shared HTTP/widgets under `lib/shared/` when truly reused. Flutter must not contain AWS credentials, CloudFront private keys, or persisted signed bearer URLs.

**P01 actual module:** `auth/` contains separate signup/login/recovery UI, a typed HTTP client, P01-3 session restoration, device management and a native Android Keystore adapter. The local API still uses the guarded loopback/ADB reverse launcher. Google sign-in is not implemented.
