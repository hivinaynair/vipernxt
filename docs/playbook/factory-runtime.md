# Running the product factory

The serial supervisor is implemented in `scripts/factory.ts`. It runs independently of this chat on a POSIX host with Bun, Git and the configured worker credentials. Closing the chat does not stop a detached run; shutting down the machine stops local scheduling and verification. A dispatched cloud worker continues remotely. Resume explicitly after a machine restart. This version has one worker at a time, a Git integration branch, a persistent ledger and an optional delivery adapter. Linear synchronization and parallel scheduling are not implemented.

## Handoff from `/next`

After the first working slice is accepted, record the user's authorization for the remaining scope in `state.yaml` decisions. `/next` expands the accepted plans into `docs/product/factory.json`, following [the example](../kit/factory.example.json). The example is a contract shape: replace its paths, IDs and commands with the product's actual acceptance checks. Commit the design, spine and plans first.

Each ticket has an ID, instructions, journey step IDs, dependencies, allowed file paths, required checks and a review command. Web slices must require a browser command. Commands are argument arrays, not shell strings. Commands, setup scripts and acceptance inputs are trusted code reviewed before dispatch. The supplied `scripts/factory/browser.ts` uses the [Playwright JSON reporter](https://playwright.dev/docs/test-reporters#json-reporter) to run an installed suite and rejects zero executed tests, failures and flaky results. Custom browser commands must write `FACTORY_BROWSER_RECEIPT` with `tree: FACTORY_TREE`, `passed: true`, and a positive integer `cases`; a zero exit alone cannot accept a web slice. Include acceptance source files in `specFiles` to protect them from edits. Path checks detect out-of-scope edits; they are not an operating-system security boundary.

```sh
bun run factory prepare docs/product/factory.json
# Inspect and commit the pinned manifest.
bun run factory start docs/product/factory.json
bun run factory status docs/product/factory.json
bun run factory cancel docs/product/factory.json
```

`prepare` validates dependencies, approval and committed spec inputs, resolves the base commit and hashes the specs. `start` dispatches a detached supervisor; it does not report success merely because a process started. `run` executes in the foreground and is also the resume command. Changed manifests require a new run ID; changed specs require a new approved handoff. No automatic scope rewrite occurs.

## Cursor Cloud (recommended)

Use `worker: { "kind": "cursor", "repository": "https://github.com/OWNER/PRODUCT" }` and `review: ["cursor-cloud"]`. The repository must be a dedicated product, accessible to both Git and Cursor. Set `worker.gitTransport: "ssh"` when the controller uses an SSH key; otherwise Git uses HTTPS and its credential must permit the repository contents, including workflow files. The API repository URL remains HTTPS. The controller reads `CURSOR_API_KEY` from its environment; do not put it in the manifest. Cursor's GitHub/Linear MCP connections do not authenticate this API client. No model override is sent. A local `CURSOR_API_KEY=...` may be kept in gitignored `.env.factory.local`; launch with `bun --env-file=.env.factory.local scripts/factory.ts start docs/product/factory.json` so detached children inherit it. Never print or commit that file.

Starting this adapter authorizes pushes to unique `codex/factory-input/` and `codex/factory-review/` refs in that explicit repository, plus Cursor-created result branches. It does not merge, create PRs or deploy. References are retained for diagnosis. Configure repository branch protections and Cursor access accordingly. Source refs carry the pinned base and subsequent accepted integration commits, so dependent workers see prior work.

Each cloud attempt persists its agent ID before POST and its run ID before polling. Lost creation responses reconcile by ID. A dead local runner resumes the same attempt; an uncertain remote outcome blocks replacement work. For a blocked remote receipt, inspect the recorded agent in Cursor and stop/reconcile it before deliberately preparing a new run. Do not delete the ledger to bypass this check. Cancellation must be confirmed terminal remotely; an unavailable API is not proof the agent stopped. This adapter uses the v1 public-beta API and needs a live account contract test after API changes.

The result branch is fetched from the configured repository, must descend from the attempt base, and passes the existing local gates. Independent Cursor review uses a fresh agent in plan mode and a JSON verdict; plan mode is a behavioral instruction, not an OS sandbox. No reviewer code is imported. Checks and browser verification still execute on the controller host. Run it on one persistent always-on host if work must progress while your laptop is off; the runtime has no multi-host failover.

For the first cloud implementation, set `phase: "first-slice"`, include one complete reviewable job (including its necessary shared structure), and record the design/slice authorization. This mode requires approved design and the participant gate, but does not require prior slice acceptance; it cannot auto-deliver and ends `awaiting-review`. After review, record acceptance and prepare a new product run for remaining work. Explicit simulations use `simulation: true` and never count as customer evidence.

## Local workers, checks and evidence

The built-in Codex adapter uses [non-interactive exec](https://developers.openai.com/codex/noninteractive), workspace-write sandboxing, no approval prompts and the user's configured model. It does not enable dangerous sandbox bypass. Missing auth, incompatible CLI/model versions or denied operations fail the attempt. Set `worker.executable` to an explicitly selected compatible Codex binary if PATH contains an older installation. `worker.kind: command` accepts an argv array for other workers and deterministic fixtures.

`setup` commands run in each isolated worktree before execution. Install dependencies here; no shared mutable node_modules tree is assumed. Jobs are serial, so one configured test port can be reused when test commands clean up their servers. Each worktree also has its own local database directory. External databases need product-specific isolation in setup.

The supervisor passes the job through stdin and stores a prompt snapshot. Workers do not own integration or publication. After implementation, the runner stages the complete diff against the attempt base, rejects paths outside the slice and changes to pinned specs, then runs required checks, browser verification, review and combined-product checks. Checks that modify the candidate invalidate acceptance. It creates a single commit with a known parent and updates `codex/factory/<run-id>` using compare-and-swap. Source checkout, staging and production branches are untouched by core execution.

The included `scripts/factory/review.ts` runs a separate read-only Codex review with structured output. A reported finding fails the stage even if the reviewer CLI exits zero. Other trusted review commands may be supplied. Evidence lives under `.factory/<run-id>/attempts/`: stage logs, progress, request, result, commit and provider token usage when reported. Runtime files are gitignored and may contain sensitive product context.

## Recovery and budgets

An OS-backed SQLite write lock prevents concurrent controllers for the repository. Killing the supervisor releases that lock; independent attempt processes persist. On restart, the ledger identifies live attempts and completed results. Exclusive attempt claims prevent duplicate execution, and Git compare-and-swap reconciles a commit integrated just before a crash. Dead attempt process groups are terminated before retry. Retries use fresh worktrees, carry the prior failure and stop at the configured count; unrelated jobs continue while dependants of exhausted jobs become blocked.

Job and run time limits include setup and checks. Cancel requests stop active work before the run becomes cancelled. Logs and worktrees are retained for diagnosis. Time/attempt caps bound execution, not exact monetary spend. Provider token usage is recorded when available; configure provider billing controls for a hard spending limit. This version does not promise an exact token cap or dollar estimate.

## Delivery contract

Without `delivery`, a successful product run ends **completed-local** (verified integration in the controller checkout, including when code was written in Cursor). First-slice runs end **awaiting-review**. The integration branch contains the working result, but nothing is described as deployed. An authorized delivery adapter supplies `command` and `verify` arrays. It must publish/merge/deploy under the product's existing policy, then exercise the actual staging URL. The verifier writes `FACTORY_RECEIPT` as JSON with `commit`, `url` and `verified: true`; the commit must equal `FACTORY_BASE` or delivery fails.

`FACTORY_IDEMPOTENCY_KEY` is stable across retries for a job/delivery. Adapters must reconcile external actions with that key and Git commit. Delivery failures are not automatically replayed: diagnose ambiguous publication first. A changed integration branch is blocked rather than silently overwriting outside work. Production promotion requires its own explicit adapter policy.

The fixture suite tests dependency ordering, repair limits, supervisor crashes, duplicate controllers, timeouts, cancellation, stale integration and wrong delivery receipts. Synthetic receipts test the contract; they are not evidence of a real deployment. Remote provisioning, provider-specific publication and multi-host durability need separate integration tests before claiming unattended production delivery.

Design rationale and source comparison: [Factory, Symphony and Cursor](factory-inspiration.md).
