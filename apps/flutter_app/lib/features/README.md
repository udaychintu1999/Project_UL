# Flutter feature layout

One feature directory per workflow (onboarding/profiles/discovery/dating/friendship/wallet/chat/local/settings). Each contains the screen, simple controller/state, API service and models needed for the current slice. Shared HTTP/widgets under `lib/shared/` when truly reused. Flutter must not contain AWS credentials, CloudFront private keys, or persisted signed bearer URLs.
