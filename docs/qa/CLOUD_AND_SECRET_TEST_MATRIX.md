# Cloud-cost + secret safety verification matrix (v2.0)

| ID | Test | Required outcome |
|---|---|---|
| SEC01 | Real `.env` under ZIP candidate | Packaging aborts; no values emitted |
| SEC02 | Private PEM/P8/key/JKS/credentials file | Packaging aborts |
| SEC03 | AWS-format access key in content | Secret scan fails, only path/code printed |
| SEC04 | CloudFront private PEM in content | Secret scan fails |
| SEC05 | Real S3/CloudFront signed URL in docs/logs | Scan fails or removes token; no query emitted |
| SEC06 | Missing `DYNAMODB_ENDPOINT` under local app | API startup refuses non-loopback fallback |
| SEC07 | `DYNAMODB_ENDPOINT=https://dynamodb...` | API startup refuses |
| SEC08 | `npm run db:provision` with AWS endpoint | Refuses; no remote calls |
| SEC09 | Test scripts import AWS S3 client / run AWS CLI upload | Static cloud mutation guard fails; human review |
| SEC10 | Owner has created DEV buckets but granted no test operation | Agent generates code only; no AWS request |
| SEC11 | AWS upload requested, no explicit scoped approval | BLOCKED; manual steps or request exact consent |
| SEC12 | Single bounded DEV upload approved, not delete | Upload scope cannot justify delete; separate approval |
| SEC13 | One CloudFront origin accidentally public | Owner security review fails; no real upload until fixed |
| SEC14 | Unsigned viewer CloudFront URL | Must return denied with actual owner-approved test |
| SEC15 | Signed URL embedded for blocked post/profile/chat | API tests fail; no new issuance |
| SEC16 | Chat image deleted and signed link still within TTL | Document residual bearer-link window truthfully |
| SEC17 | Local backend default media driver | `local`; no implicit real S3 due to credentials existing |
| SEC18 | Packaged archive checked after build | All project-relative files; no `.env`, `.aws`, binary media or keys |
| SEC19 | AI Chat environment can't run AWS tests | Generate scripts/runbook; mark UNVERIFIED |
| SEC20 | Live payment/provider step P16/P17 not authorized | No charges or payment operations, UNVERIFIED |

Portable checks run through `npm run test:secrets`, `npm run test:cloud-guards`, `npm run test:portable`, and package-safe script. Real AWS negative tests are *not* performed until owner authorizes exact minimal test(s). No AI receives real credentials.
