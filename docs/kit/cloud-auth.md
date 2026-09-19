# Cloud browser authentication

Use Clerk when authentication is required. This scaffold supplies test helpers, not application auth wiring or proof that a journey passes.

## Before dispatch

Shaping records an access matrix: actor, organization, allowed actions/data, forbidden actions/data. Plan ClerkProvider, `/sign-in`, protected server routes/actions, organization selection and database ownership checks in the foundation/first journey. Clerk identifies users and supplies membership/permission claims; the application still enforces domain rules and tenant-scoped queries.

Create dedicated users in a **Clerk development instance**: one for each materially different role and another organization for isolation tests. Seed their memberships and synthetic app records deterministically. Record only environment-variable names and expected roles in the approved spec. Never use personal or production accounts.

Configure Cursor environment **Runtime Secrets**, not Build Secrets:

| Variable | Purpose |
|---|---|
| `CLERK_SECRET_KEY` | Development instance server key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Same development instance as the tested app |
| `E2E_CLERK_<ROLE>_EMAIL` | Existing dedicated actor; e.g. STAFF and OTHER_TENANT |
| `E2E_BASE_URL` | Approved local or staging URL |

Set the same Clerk instance on the test deployment. Runtime secrets are available to running code; Cursor redaction is not isolation from the agent. Do not print secrets, persist sessions, bake keys into images, or put them in issues/prompts. If networking is restricted, allow the app, its Clerk frontend API host and `api.clerk.com`. Missing credentials block verification; never introduce a fake auth bypass.

## Execution

Scaffolding web with auth installs `@clerk/testing` and Playwright and adds `bun run e2e`. Install Chromium in the cloud environment with `bunx playwright install --with-deps chromium`. Start the app separately for local tests, or supply the approved deployed URL.

Write journey specs under `apps/web/e2e/*.spec.ts`, citing spine IDs. Use `signInAs(page, 'E2E_CLERK_STAFF_EMAIL')` from `./sign-in` in a fresh context. Explicitly select and assert the intended organization before actions. The helper uses Clerk's backend-assisted sign-in; it verifies authenticated business behavior, **not** the sign-in UI, MFA or SSO. Add separate real UI sign-in/logout coverage for the approved authentication flow. Testing tokens suppress bot detection, not authorization.

Verify signed-out denial, permitted behavior, forbidden roles, another tenant's IDs, persistence after reload and error recovery. Exercise server/API denial as well as hidden controls. Setup success alone is not journey evidence. Review must name the tests, actors and results; screenshots may be captured explicitly after login with synthetic data. Session traces/videos stay off by default.

## Sources

Checked 2026-09-20: [Cursor secrets](https://cursor.com/docs/cloud-agent/security-network), [Clerk Playwright setup](https://clerk.com/docs/guides/development/testing/playwright/overview), [Clerk sign-in helpers](https://clerk.com/docs/guides/development/testing/playwright/test-helpers). Clerk Agent Tasks is beta; this workflow uses the testing helpers rather than adding an impersonation endpoint to the product.
