# Repository layout and delivery

Root contains `AGENTS.md`, `README.md`, `package.json`, `apps/`, `infra/`, `scripts/`, and `docs/`.

- `apps/api`: Fastify/TypeScript + DynamoDB client; one feature module added per phase.
- `apps/flutter_app`: Flutter Android-first UI; real backend integration per feature.
- `apps/admin`: separate future P14 admin website; placeholder now.
- `infra/local`: Java DynamoDB Local instructions; no Docker or production cloud resources.
- `scripts/db`: idempotent schema provisioner backed by canonical 18-table catalog.
- `scripts/dev`: developer operations; `.env.example` no secrets.
- `scripts/verify`: automated tests and local QA run commands.
- `docs`: canonical product, architecture, phases, QA and manual instructions.

Every new step ZIP must include **changed code/test files plus updated `docs/` directory** in project-relative paths; preserve runnable dependencies and do not silently reset existing product work. Avoid including `node_modules`, binaries, personal tokens or copied developer data. Maintain a machine-readable manifest and evidence where appropriate.

Full handoff ZIP contains all scaffold files; later step ZIPs should normally be update-only per developer preference. Neither update-only nor full handoff may claim test execution without actual logs.

**v1.1 environment note:** Run P00–P15 real DB tests using Java 17+ DynamoDB Local (no Docker); use local media adapters; P16 payment-provider sandbox and P17 real AWS production cloud/media integration. Do not mark unexecuted checks PASS.

**FINAL v2.0:** Mandatory `npm run test:secrets`, `npm run test:cloud-guards` and `scripts/release/package-safe.py` (full or update mode). Owner creates DEV 2 private S3 buckets + DEV CloudFront early, but AI tools have no AWS permission unless separately scoped. Java DynamoDB Local stays through P16. BE feature modules in `apps/api/src/features/*`, Flutter feature modules in `apps/flutter_app/lib/features/*`; avoid flattened monolith and unnecessary microservices. See `docs/architecture/14_FEATURE_MODULE_STRUCTURE.md`.
