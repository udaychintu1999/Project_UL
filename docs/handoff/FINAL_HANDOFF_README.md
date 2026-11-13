# FINAL v2.0 handoff — use with coding agents OR regular AI Chat

- Initial session: paste `docs/handoff/INITIAL_PROMPT_UNIVERSAL.md` with **entire v2.0 full ZIP**. Continued session: paste `CONTINUE_PHASE_PROMPT_UNIVERSAL.md` and supply project + latest update ZIP. Security files are mandatory and have highest priority.
- Same 18 phases P00–P17, each D1/D2/D3 + T1/T2/T3, one small complete backend/Flutter/Java local-DB slice. Generate full executable code+tests; execute what the environment actually supports; automatic defect repair; exact Windows manual steps; no fabricated PASS.
- **Owner-only early setup:** 2 private DEV S3 buckets, 1 DEV CloudFront distribution. No AI AWS operations/upload without fresh exact owner approval; no actual `.env` or secret reads. P00–P16 Java DynamoDB Local. P16 payment sandbox; P17 real AWS DynamoDB and production media/ECS with release permission.
- Before every change ZIP: `npm run test:secrets` and `npm run test:cloud-guards`, and use safe packaging to include only changed source/tests/scripts plus `docs/` (never secrets/binaries). Record evidence and UNVERIFIED cloud tests.
- This project is a developer handoff and P00 starter; no production AWS resource was deployed and P01–P17 are NOT IMPLEMENTED by the ZIP.
