# Approved unattended delivery

After readiness approval, the serial driver builds slices, independently reviews exact commits, verifies the combined product, opens a draft PR, checks approved CI, repairs within budget, and optionally deploys and tests staging. It retains the checkpoint when a requirement, permission, provider configuration or budget prevents progress. No production merge or deployment is included.

Add these opt-in policies to the approved coverage catalog:

```json
{
  "ci": {
    "app": "github-actions",
    "checks": ["Test", "Build"],
    "maxRepairs": 2
  },
  "deployed": {
    "environment": "staging",
    "origin": "https://staging.example.com",
    "creator": "github-actions[bot]",
    "checks": [["bun", "run", "e2e:staging"]],
    "browser": ["bun", "run", "e2e:staging"],
    "automatic": {
      "workflow": ".github/workflows/factory-staging.yml",
      "setup": [["bun", "install", "--frozen-lockfile"]],
      "command": ["bun", "scripts/deploy-staging.ts"],
      "sources": ["scripts/deploy-staging.ts"]
    }
  }
}
```

Replace the example check names, commands and origin with this product's contracts. The kit does not contain a product deploy script. The approved command deploys the checked-out candidate to its staging target and returns **only** `{"url":"https://staging.example.com"}` on stdout. The command owns provider-specific build/upload/alias behavior. It receives approved staging secrets and `FACTORY_STAGING_URL`; it must never infer or select a production project. Its source, setup/configuration, `.github/workflows/factory-staging.yml`, `.github/scripts/factory-staging.ts` and the coverage catalog must be pinned. Include the deployment controls and command sources among packet artifacts, binding their content to the approval. The `staging` action must be included in that decision.

Install the workflow on the repository default branch so GitHub accepts dispatch, and on the approved target branch with identical control content. Configure the GitHub App token for Actions dispatch/read, contents/ref writes, PR creation and deployments read. The workflow's token has contents read and deployments write; checkout credentials are not persisted. Configure the GitHub `staging` environment with dedicated staging credentials. The supplied environment variables support Vercel (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`); adapt the pinned workflow for another provider. Environment protection requiring a human reviewer will deliberately park deployment; unattended delivery requires a policy that permits this already-approved workflow. Provider costs remain governed by the engagement's approval and budget; elapsed-time/attempt limits do not establish a hard dollar cap.

Subscribe the GitHub App to `check_suite` and `workflow_run` alongside existing events. Signed events only wake durable execution. The engine reads fresh check/deployment records; webhook text never accepts a candidate or grants new scope. Durable reconciliation also covers missing callbacks: up to five minutes for Cursor, one minute for CI/deployment, with callbacks waking earlier. No cron service is required.

CI requires exact candidate SHA, approved app and all named checks. Pending, missing, stale and foreign-app checks cannot authorize deployment. A failed check set reserves one durable repair; repeated delivery of that failure does not consume another repair. Repairs can touch only the union of approved implementation paths, with pinned evaluators/controls protected. Independent review verifies all catalog criteria. Explicit implementation defects found in integrated acceptance or automatic deployed acceptance can also reserve up to two repairs. After each repair the engine repeats integration, CI, deployment and deployed verification as applicable; rejection, missing policy/permissions and malformed final evidence hold. These repairs share the original time and station budgets. A passing repair advances the existing PR branch without force-push, then repeats integrated acceptance and fresh CI on the new SHA. Unexpected branch movement or repeated failure beyond budget holds. Transient HTTP 429/5xx and network timeouts retry the same persisted station/request identity up to three times, with durable backoff; authorization errors hold immediately. Recovery never extends the original clocks. Configure enough station attempts for the initial integration plus permitted repair integrations; `maxRepairs` never increases manifest attempt/time limits.

Automatic deployment persists a request ID and control hashes, creates a dedicated input ref at intake, checkpoints dispatch intent while retaining its lease, and dispatches that pinned workflow once. On an ambiguous HTTP response it searches workflow runs and GitHub deployments for the same request/run/candidate instead of blindly dispatching again. A crash after intent was saved but before the request was sent can therefore hold at the original deadline with no deployment; the owner must investigate before issuing a newly authorized intake. This prefers an explicit hold to duplicate deployment side effects.

The workflow checks control/coverage hashes and checkout SHA, runs the approved command, validates the returned staging origin and publishes a non-production GitHub deployment/status bound to request ID and workflow run ID. Eve verifies those authenticated records, trusted creator, exact candidate, latest staging deployment and current success before launching a fresh deployed reviewer. It checks again at completion, including fresh required CI. Only actual deployed acceptance of all criteria permits `mvp-complete`; first-slice scope yields `slice-complete`. Automatic delivery cannot extend the original run deadline; deployed acceptance also has its stage deadline. Hosting metadata remains trusted publisher evidence, not independent infrastructure attestation.

Without `automatic`, the existing manual deployment-receipt/relabel path remains available. Without `ci`, delivery remains the existing integrated-review draft PR. Those modes never imply automatic deployed completion. The factory supports one active batch and serial jobs. Parallel scheduling and production release remain future scope.

Local proof covers strict approval/review, duplicate CI repair, candidate branch updates, ambiguous dispatch restart, stale/mismatched records, superseded staging status and exhausted budgets. Build validates compatibility with Eve 0.63. Hosted two-slice recovery and actual provider deployment/browser evidence still need a budgeted engagement; deterministic fixtures do not certify a live installation.
