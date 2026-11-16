# U_luv UI Implementation Contract for AI Agents and AI Chats

## Use this pack correctly

- **Read before coding:** root `AGENTS.md`, `docs/START_HERE.md`, and `docs/product/PRODUCT_CONTRACT.md` from the latest **U_luv Full Developer Handoff FINAL v2.0**, then this file, `SCREEN_REGISTRY.md`, and `FLOWS_AND_RULES.md`.
- **Find the relevant image:** locate its ID in `SCREEN_REGISTRY.csv`, open only the individual relevant `images/canonical_screens/` PNG(s) and corresponding `contact_sheets` page. Inspiration boards are aesthetic mood only.
- **Make real Flutter code:** use existing feature-folder structure, data models, app routing, theming and permissions. Do not implement the prototype HTML directly. Do not add a new backend or change database tables to match mock screenshots.
- **One vertical slice per task:** backend+local DynamoDB (when relevant), Flutter UI, success/error/empty states, API and widget tests, real available tests, fix bugs, updated docs and changed-file ZIP.
- **No unapproved product features:** visual artwork isn't an authorization to add functionality.

## Exact deliverables for each implemented screen

1. Flutter screen/widget source integrated with existing navigation.
2. Reusable theme tokens and components where justified.
3. Loading, empty, error, offline, and permission states; semantic labels; dynamic text; responsive layouts.
4. Unit and widget tests (and golden tests if feasible) that validate visible business-rule copy and state.
5. API integration tests where data/state is altered (likes, paid transactions, requests, Local post, message delete, reports).
6. Screenshots or golden artifacts when actually rendered; if not, mark visual review **UNVERIFIED** and provide instructions.
7. Documentation update, manifest of modified files and ZIP using project-relative paths.

## AWS and secret guard

- Java DynamoDB Local remains canonical through P16. No remote DynamoDB endpoint fallback.
- Any S3/CloudFront/cloud API calls, including `HEAD`, `GET`, `LIST`, `PUT`, deletes, and test uploads, require **fresh explicit owner authorization**. Do not assume that the user setting up two dev S3 buckets grants agent access.
- Agents must not inspect, print, copy, edit, bundle or reveal `.env`, AWS credentials, payment secrets, signed URLs, private keys or actual signing tokens. Use `.env.example` placeholders only. Never include them in screenshots, test logs or ZIPs.
- For AI Chat without Flutter or cloud runtime, generate all executable source/tests and exact human steps and mark actual device/cloud verification **UNVERIFIED**.

## AI prompt to use with a screen

> Implement U_luv screen `[SCREEN_ID]` following `docs/ui/AI_IMPLEMENTATION_CONTRACT.md`, `docs/ui/FLOWS_AND_RULES.md` and its exact canonical screenshot. Read the current U_luv Developer Handoff and active phase instructions. Reuse Flutter components and feature folders. Implement functional UI integrated with actual local backend as appropriate, test success/error/empty and permission cases, run every test the environment supports, fix defects, and deliver only changed project-relative files plus updated docs in a safe ZIP. Do not call AWS or access secrets. Clearly identify any verification that could not run.
