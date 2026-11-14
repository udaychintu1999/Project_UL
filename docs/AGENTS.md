# CURRENT AUTHORITATIVE CHECKPOINT — P01-3 OWNER-ACCEPTED (2026-11-14)

**P00:** `CORE_FLOW_VERIFIED` (historical owner evidence). **P01-1:** manually accepted; its standalone Android OTP automation remains **FAILED**, explicitly accepted for *local development only* (never report PASS or production waiver). **P01-2:** owner-accepted after Windows automated and manual testing. **P01-3:** **OWNER-ACCEPTED for local development** after complete `npm run verify:p01-3` automated pipeline PASSED on Windows/physical Android and the owner reported that final manual phone testing worked as expected. **P02:** NOT STARTED; next is P02 specification/design review, not automatic authorization to implement.

**Evidence:** `docs/qa/P01_3_OWNER_ACCEPTANCE_2026_11_14.md` (current) and historical `docs/qa/P01_3_INITIAL_IMPLEMENTATION_EVIDENCE_2026_11_14.md`. A real 30-day elapsed-time field observation and production/security/provider readiness have **not** been demonstrated by these logs; automated 30-day boundary tests passed. Do not equate owner acceptance of local development with production release. Java DynamoDB Local remains the database through P16; no AWS/email-provider/payments integration is authorized by this acceptance. Earlier status blocks below are preserved as dated history, not current instructions.

---

**DESIGN REVIEW HOLD (2026-11-13):** P01-2/P01-3 are documentation-only until owner approves the new contracts. Password target changed to NIST SP 800-63B-4 single-factor minimum 15 Unicode code points and no mandatory symbol or category rules; existing source/tests still implement 8+punctuation. Confirmed Email-code login DOB/consent defect and Android recovery Reset missed tap remain unresolved. Read `docs/design_reviews/README.md` before code.

# Quick agent rules — v2.0 FINAL

**Read root `AGENTS.md` and `docs/security/00_NON_NEGOTIABLE_GUARDS.md` FIRST.** Same requirements apply to AI Chats and coding agents. No reads of actual `.env`/secrets or AWS profiles. Two DEV buckets + one DEV CloudFront distribution are created manually by owner early, but agents/scripts have zero permission to call AWS without separate narrow authorization for every real cloud operation. Java DynamoDB Local through P16; real AWS DynamoDB/prod media P17; payment sandbox P16. BE+Flutter feature slices D1–D3/T1–T3; run possible tests, fix failures, record UNVERIFIED for unavailable tests. Update source+docs ZIP with safe packaging and mandatory guards.
**Escalation:** Repeated failed/device-blocked automation MUST trigger a specific owner-run manual-test request, not endless speculative patches. Preserve automated FAIL separately from observed manual PASS; do not waive release/security gates. See `docs/qa/MANUAL_VERIFICATION_ESCALATION.md`.

**AUTOMATED-FIRST:** Execute every feasible phase-specific automated check, especially real Android P01-2 password UI journeys, before requesting manual verification. P00 two-button diagnostics and portable contracts do not replace P01-2 device coverage. Owner-accepted P01-1 OTP Android failure remains a separately documented, failed local-development exception only. See `docs/implementation/QA_AUTOMATION_CONTRACT.md`.
