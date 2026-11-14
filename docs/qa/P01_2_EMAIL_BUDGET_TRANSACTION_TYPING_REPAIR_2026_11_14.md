# U_luv — P01-2 password recovery transaction typing repair (2026-11-14)

## Owner-reported failure

`npm run typecheck` failed on Windows at `apps/api/src/features/auth/password.ts:146` with TypeScript TS2322: an inferred heterogeneous array of `TransactWriteItem` values produced optional `undefined` properties in `ConditionCheck.ExpressionAttributeNames`. This violates the AWS SDK `Record<string,string>` requirement. The owner did not report a runtime failure from this error.

## Minimal source repair

The password-recovery `issueEmailChallenge` callback now declares its return type explicitly as `NonNullable<TransactWriteCommandInput['TransactItems']>`. This supplies contextual typing to each transaction item and its DynamoDB conditional expressions instead of allowing the compiler to infer a union of the unrelated `ExpressionAttributeNames` shapes.

No quota limit, API route, account eligibility, email send behavior, transaction operation, Flutter code, database schema, or P01-3 session contract was changed.

## Regression test

Added a Node source-contract test to `scripts/verify/p01-2-automation.test.mjs` that requires explicit AWS SDK contextual typing at the password-recovery callback. This protects the exact reintroduced-inference regression, but **does not substitute for the real TypeScript semantic typecheck**.

## Evidence

- Authoring environment: `npm run verify:p01-2:portable` **PASS**, including the new typing guard (14 automation-contract checks).
- `node:module.stripTypeScriptTypes` parse of `password.ts` **PASS**.
- `npm install --offline --ignore-scripts --no-audit --no-fund --package-lock=false` **UNAVAILABLE**: `ENOTCACHED` for `@aws-sdk/client-dynamodb`.
- Windows full `npm run typecheck`: **UNVERIFIED after repair**; owner must rerun.
- Windows live quota test / Flutter / physical Android: **NOT RERUN for this type-only patch**; preserve prior evidence and run the complete gates as applicable.

## Owner commands

Keep the existing local project, `.env`, lockfile, modules and DynamoDB data. Extract the update-only ZIP at the project root. Execute:

```cmd
npm run typecheck
npm run verify:p01-2:portable
```

If both succeed, keep Java DynamoDB Local and Fastify running and perform:

```cmd
npm run test:p01:email-budget:integration
npm run test:p01:password:integration
npm run test:flutter
npm run test:flutter:p01-2:e2e
npm run verify:p01-2
```

Do not claim full P01-2 acceptance merely from portable PASS. Follow automated-first, then manual UX verification. P01-3 remains unstarted.
