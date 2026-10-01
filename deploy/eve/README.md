# Eve factory

Eve coordinates approved, hash-bound batches on Vercel; Cursor Cloud implements and independently reviews slices. A trusted GitHub factory label starts registration. There is no deployment switch that silently approves work. The local factory CLI is a development runner.

Follow [START](../../docs/START.md) for credentials/linking and [COVERAGE](COVERAGE.md) for job, scope and acceptance contracts. This package installs/builds independently of the product app:

```sh
bun install --frozen-lockfile
bun test
bun run check-types
bun run build
```

Runtime: Node.js 24. Keep the four disabled built-in tool stubs: deleting them can restore broad shell/file/agent tools from the SDK.

## Execution and authority

One factory-batch issue block pins intake commit and manifest. Intake must be on the target branch; manifest.base may be intake or an ancestor. [Readiness](../../docs/playbook/requirements-packet.md) binds scope, contracts and authorized actions; coverage reconciles every criterion. An approved first slice cannot certify the whole MVP.

Workers start from pinned factory/input refs, implement with Cursor Grok 4.6 and push one cursor/ branch. A separate recognized-vendor/model reviewer checks the exact SHA and returns structured evidence. Slice changes and fresh verification are bounded; advisory notes cannot erase blocking findings. Integrated review precedes draft-PR delivery. [AUTOMATION](AUTOMATION.md) defines approved CI repair, staging deployment and actual-site acceptance. Production release remains separate.

GitHub factory/state checkpoints use compare-and-swap and leases. One active batch is supported. Authorized relabeling can adopt the same issue/intake within original clocks/budgets; another intake archives the predecessor. Unknown write outcomes hold instead of duplicating work.

## Product runtime and callbacks

Copy hooks/cursor-stop.mjs to .cursor/hooks/factory-stop.mjs. Preserve existing .cursor/hooks.json and add this stop entry:

```json
{"command":"node .cursor/hooks/factory-stop.mjs","timeout":40}
```

Create .cursor/factory.json with callbackUrl set to https://your-factory.vercel.app/callbacks/cursor. FACTORY_CALLBACK_AUDIENCE is its origin. Never put the Cursor API key in these files.

Pin these controls plus .cursor/environment.json and .cursor/Dockerfile in specFiles. They must match the repository default branch because Cursor Builds use that configuration. The environment needs its Dockerfile and an install command containing bun install --frozen-lockfile. Refresh and verify the active Build with all fixture/browser tools and runtime secrets.

The stop hook uses short-lived Cursor OIDC; the callback verifies issuer/audience/expiry/registered identity and only wakes durable execution. It cannot accept work. Missing first-turn hooks are possible; durable reconciliation remains the fallback. No cron/polling tool loop is required. Fresh workflow owners prevent predecessors retaining wake tokens.

Use explicit relative evaluator paths (bun test ./e2e/example.eval.ts); bare names can be discovery filters that skip cases. Complete required command output and actual browser evidence matter. Hook diagnostics omit tokens and go to /tmp/vipernxt-factory-hook.jsonl in the worker.

## Jev and owner attention

The durable driver invokes Jev automatically for eligible failures. Investigation is bounded/read-only; recommendations cannot grant permission, extend clocks or launch uncertain duplicate workers. Repair/retry recommendations need a complete probability distribution, unique route and ≥0.8 probability; this is policy, not calibrated accuracy.

Scope/credential/policy/rejection/budget guards bypass the model. Weak, missing or unavailable diagnoses eventually hold for the owner. classify_failure can refresh a held diagnosis; if it resumes, it owns continuation—do not then call start_batch. Registration failures have no batch to recover automatically.

Optional [Slack](SLACK.md) alerts include failure, recovery attempts, needed action and evidence. Four Slack bindings enable signed owner-only Hold/Retry/Reject and thread evidence. Delivery is checkpointed, retries bounded, uncertain posts reconciled read-only; unconfigured/pending status never means sent. Slack cannot approve requirements, acceptance or releases. GitHub remains fallback.

## Controlled simulations and limits

An explicitly authorized disposable repository may use FACTORY_SIMULATION_REPO plus simulation:true: staging, first-slice only, at most two jobs/two attempts, 20-minute stations and a two-hour batch. Synthetic evidence cannot certify customer behavior or an MVP.

Opt-in fault campaigns additionally need matching FACTORY_FAULT_CAMPAIGN and a simulation faults plan. Durable ledgers prevent endless replay. Disable the campaign and redeploy after testing; never use it for customer work. Injected failures do not prove spontaneous physical outages.

Controlled hosted trials demonstrated bounded staging/recovery, but a new installation needs its own provider and browser checks. Historical private-pilot reports remain in Git history rather than the starter. Tests exercise engine, triage, callbacks and owner notification; they cannot guarantee universal delivery.

Based on the MIT-licensed Vercel Foreman template at 0d630a284b84e5be38fe7eceec7b231a7e79bfd0; see [FOREMAN-LICENSE](FOREMAN-LICENSE). References: [Cursor hooks](https://cursor.com/docs/hooks), [Cursor identity](https://cursor.com/docs/cloud-agent/identity).
