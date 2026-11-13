> **FINAL v2.0 cloud/secret gate:** NO AI/automation AWS actions until explicit per-operation owner permission (even read-only). Do not access real .env or signing keys. Owner manually sets up two DEV private S3 buckets and one DEV CloudFront distribution early; local media tests are mandatory. Java DynamoDB Local through P16, prod AWS P17, payment sandbox P16. See `docs/security/00_NON_NEGOTIABLE_GUARDS.md`.

# Environment gate test matrix — Java local, late AWS and payments

| Phase | Must run if environment available | UNVERIFIED when unavailable | Must NOT be claimed before |
|---|---|---|---|
| P00 | Java DynamoDB Local 18 tables, direct Put/Get/Query/Delete, real Fastify ↔ Flutter test | API/local DB/device | P00 actually executed |
| P01–P15 | Java local DB + media adapter + Flutter/API tests | Real device if missing, Flutter SDK if missing | No real S3/production DB/payment provider before P16/P17 |
| P16 | Real Google Play Billing official sandbox receipts, refunds; local wallet tests | Store sandbox without merchant/test setup; AWS infra review without account | Do not claim cloud production readiness from IaC templates |
| P17 | Real AWS DynamoDB staging/production 18-table parity, S3/CloudFront/ECS integration, official payment/store sandbox, Flutter device E2E | Unavailable provider/staging checks | No production release if P0 checks UNVERIFIED |

**Always** log exact commands, observed output, pass/fail/unverified and follow-up manual actions. No Docker requirement. No provider credentials or project media in logs/ZIPs.
