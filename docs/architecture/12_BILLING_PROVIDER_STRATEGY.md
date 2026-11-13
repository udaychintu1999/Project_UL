# Payment and settlement architecture — postponed integration, not postponed wallet

## Core separations

1. **Credits / ledger (P04)**: balances, monthly 4/2 free grants, purchased balance, paid Like Back, Connect, Friendship send, refunds/corrections; all validated with atomic DynamoDB Local operations and idempotent operation IDs.
2. **Product catalog (local fixtures until P16)**: Starter 3 credits ₹49, Standard 10 ₹149, Value 30 ₹399 as targets; display prices from real storefront only after P16.
3. **Payment provider**: abstract `PurchaseProvider` identity, verified transaction ID, product ID, currency, state, signed receipt or server-verifiable purchase token, store and time; no direct authority to mint credits merely from Flutter success callback.
4. **Grant/revoke/reconcile**: backend verifies, atomically claims unique receipt ID and grants exactly once; handle refunds/chargebacks and delayed callbacks safely.

## Channels

| Channel | Launch approach |
|---|---|
| Google Play Android | Google Play Billing, with server-side purchase verification and official sandbox in P16 |
| India alternate gateway | Only after eligible/enrolled Google Play alternative billing program and applicable disclosures/reporting; do not hardwire into early Flutter |
| Apple iOS later | StoreKit / Apple In-App Purchase adapter + verification, prepared in P16 docs and integrated before iOS release |
| Website or other distribution | Separate policy/economics review before implementing external gateway checkout |

Payout means store/provider settlement to the developer bank account; it is not an alternative in-app billing SDK.

**Security tests to write before P16:** one-time receipt grants, replay/malformed receipts, wrong user/account, refund reversals, multiple simultaneous claim attempts, payment succeeds but grant times out, and no negative balance. P16/17 must run real provider sandbox checks, not just mocks.

Sources: https://support.google.com/googleplay/android-developer/answer/9858738 ; https://support.google.com/googleplay/android-developer/answer/13306652 ; https://developer.apple.com/app-store/review/guidelines/ .
