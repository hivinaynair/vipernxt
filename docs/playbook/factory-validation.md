# Requirements and factory implementation validation

Validated on 2026-09-30 in the staging-based `codex/requirements-readiness` worktree. Base staging commit: `bbd3357f717b752d6f0075e263498fd8d9672f14`. This is kit/runtime validation, not customer product acceptance.

Implemented: hash-bound requirements approval and action scope; canonical artifact/case trace checking; held-finding and assumption gates; exact reviewer SHA/argv/criterion IDs; independent model vendor selection; reviewer-only recovery; retained revision candidates and fixed budgets; bounded transport, integration, deployed and CI repairs; existing-PR branch updates; pinned single-dispatch staging workflow; authenticated deployment reconciliation and actual-site completion gate.

Validation passed:

- `bun test`: **379 tests across 41 files**, including the Eve tests. No double counting of standalone Eve tests.
- Root `check-types`, `check-boundaries`, `check-tokens`, `check-journeys`, `check-requirements`, and `git diff --check`.
- Eve `check-types`, ordinary build, and Vercel-targeted build (`VERCEL=1 bun run build`). Builds used `NODE_USE_ENV_PROXY=1` for public model metadata access.
- Both generated Vercel function configurations have `maxDuration: 60`, below the five-minute dispatch lease.

Failure/restart fixtures exercise changed approval hashes, missing applicability/trace, synthetic walkthrough denial, unaccepted assumptions, open material findings including empty scope, malformed/invented reviewer evidence, retry ceilings, changed target heads, stale/foreign/partial CI, duplicate repair events, repair branch updates and repeated integration, uncertain deployment dispatch, mismatched workflow ref/request/run/SHA, superseded staging receipts, unapproved URLs and revoked deployment success. Explicit implementation defects can repair within the existing contract; authorization errors and unknown policy hold.

The bare kit has no product app or engagement spine. Boundary, token and journey checks therefore report no applicable product files; the requirements command reports no engagement packet. These outcomes certify no customer behavior. Tests use deterministic fixtures and mocked provider transports. No paid agents, GitHub workflow dispatch, hosting deployment, push or merge was performed during this validation.

Before live operation, supply the product's approved packet, reproducible worker environment, exact CI names, deployment command/source, staging origin, staging credentials and callback subscriptions described in [automation](../../deploy/eve/AUTOMATION.md). Hosted two-slice restart recovery and actual deployed browser acceptance remain unverified. The structural gate cannot guarantee exhaustive discovery or correct customer policy; observed walkthroughs and behavioral evidence remain required.
