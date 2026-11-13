# Cross-phase end-to-end regression matrix

All are required as runnable scripts + UI scenarios. Tests listed are **NOT EXECUTED** in this plan.

| ID | Journey | Phases | P0 invariant |
|---|---|---|---|
| E2E01 | Google/Email OTP → adult account → activate both profiles (2 photos each) | 01–03 | No underage access; no private contact leak |
| E2E02 | Selected locality → Dating 0–10,10–35,35–50/all bands | 03,06 | No popularity ranking, no out-of-radius result, pagination stable |
| E2E03 | Ordinary Like A→B, B→A → mutual match → paid Connect | 04,06–08 | Ordinary Like free, one Connect debit only |
| E2E04 | Incoming Like → free Liked You preview → paid Like Back → paid Connect | 04,06–08 | Separate 1+1 credits, both confirmations, chat real |
| E2E05 | Both people click Connect at once | 04,07–08 | Exactly one pair entitlement/one debit |
| E2E06 | Friendship request charge → reject/expire | 04,09 | Nonrefundable successful send, no failed-send charge |
| E2E07 | Friendship request charge → accept → real chat | 04,05,09 | Recipient pays zero, entitlement free afterward |
| E2E08 | Local post with five photos, new city/band, 7-day expiry | 03,10,15 | Locality access valid; expired post/media not visible |
| E2E09 | Local post comment and react caps | 10–11 | 10/day,30/day, once/post; blocked post inaccessible |
| E2E10 | Activity create → local browse → paid request → accept | 09–12 | One canonical post; activity expiry respected |
| E2E11 | Chat text/photo → 7-day expiry and delete for both | 05,08,15 | Old message not returned; lifetime entitlement persists |
| E2E12 | Block/report/temporary hide → admin review → restore | 13–14 | Cross-mode block, immediate authority enforcement |
| E2E13 | Monthly 4/2 grant, no rollover, purchased credit persists | 04,16 | No double grant, no negative wallet |
| E2E14 | Store purchase delayed/retried/reversed | 04,16 | Receipt processed once; correct wallet and ledger |
| E2E15 | Unmatch → fresh mutual interest → reconnect; blocks override | 07–08,13 | No automatic reconnection/duplicate Connect charge |
| E2E16 | Pan-India multi-city geo seed and dense-city pagination | 03,10,17 | No Scan; measurable Query fan-out and realistic latency |

## Testing tiers

- T1: pure unit/type/widget where no provider is needed.
- T2: real local services including DynamoDB Local, API, seeded fixture, concurrent operations.
- T3: Flutter integration emulator/physical Android, browser Admin/Playwright, payment sandbox where available, manual human fallback.

Never change test type labels to disguise missing real-provider coverage.

**v1.1 environment note:** Run P00–P15 real DB tests using Java 17+ DynamoDB Local (no Docker); use local media adapters; P16 payment-provider sandbox and P17 real AWS production cloud/media integration. Do not mark unexecuted checks PASS.
