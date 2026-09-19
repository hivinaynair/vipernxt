# Unattended product factory

The target is an approved product built and verified on staging without repeated human prompts. The user reviews the resulting product and starts a new change cycle. The [serial supervisor](factory-runtime.md) supports local workers and Cursor Cloud. The optional [hosted controller](controller.md) adds Linear commands and separate Cursor verification; local execution can still use host verification. This document describes the wider target architecture. End-to-end hosted validation is in progress; automatic delivery and parallel scheduling remain separate work.

## Entry and completion

The entry gate is an approved design, versioned journey spine, acceptance criteria, and an accepted first working slice. Record permission to implement the remaining agreed scope, integrate into staging, provision permitted services, and spend within a budget. Reuse existing authorization. Human review belongs at this boundary and when scope or permissions change, not between every mechanical phase.

Finding a second person with the problem remains mandatory for a real engagement. This validates that the problem is shared; it does not automatically require a full customer deployment engagement. A personal product may need interviews and usability sessions. An FDE engagement additionally needs access, observed workflows, systems of record, exception handling, rollout ownership and operating constraints. Scale evidence to the problem. Simulation evidence remains synthetic.

Completion means all required journey steps have implementation evidence, the combined product passes its acceptance scenarios, and the staging deployment has been exercised at its actual URL. A merged PR or successful compiler run alone is insufficient. Production release follows the separately configured release policy.

## Research and choice

[OpenAI Symphony](https://github.com/openai/symphony) is the closest architectural reference: it turns issue work into isolated agent sessions. Its [specification](https://github.com/openai/symphony/blob/main/SPEC.md) separates tracker integration, scheduling, workspace management and agent execution. It is an engineering preview, so evaluate its implementation against this kit's acceptance and integration requirements before adopting it.

[Factory Droid Exec](https://docs.factory.ai/droid-exec/overview) illustrates a headless worker interface. A worker command alone does not provide a durable queue, restart recovery or deployment acceptance. [GitHub's cloud agent](https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent) is another execution option where repository-hosted task and PR operations fit. Whether a provider can execute unattended depends on its configured credentials and approval behavior; a connector available in this chat is not proof of daemon access.

[Anthropic's long-running application harness work](https://www.anthropic.com/engineering/harness-design-long-running-apps) supports treating environment setup, incremental work and browser verification as harness responsibilities. Its reported runs are not a portable cost benchmark for this kit. More agents and more review loops are hypotheses to measure, not automatic improvements.

Recommendation: retain `/next` as the product-discovery and approval interface. Put unattended execution behind a small supervisor with a replaceable worker adapter. Start with a repository queue and one serial worker; evaluate Symphony before building equivalent orchestration from scratch. Linear should expose work to humans, not become the only durable copy of the product plan.

## Authoritative records

| Record | Owns | Must not own |
|---|---|---|
| Design and journey spine in Git | Scope, step IDs, acceptance, dependencies | Worker process state |
| Generated job manifest, pinned to a spec commit/hash | Executable slices, allowed paths, required checks | New product decisions |
| Supervisor ledger | Claims, leases, attempts, retry times, integration state, cost | Rewritten requirements |
| Linear or another tracker | Human board and links to jobs/evidence | An independent conflicting acceptance spec |
| Evidence bundle at an exact commit | Command results, scenarios, screenshots, deployment result | A worker's unsupported “done” assertion |

Each job includes a stable slice ID, spec hash, dependency IDs, journey step IDs, allowed paths, seed references, acceptance commands, required browser scenarios, evidence destinations and limits. Changed requirements invalidate affected pending jobs and their dependants. A completed job is reusable only when its inputs and dependencies remain compatible.

## Execution loop

1. Reconcile the ledger with actual workers, branches, PRs and deployments before scheduling. Claim a ready job atomically, issuing an attempt ID and expiring lease.
2. Allocate an isolated worktree, branch, port and data namespace. A lease timeout does not justify two active workers: cancel or fence the previous attempt before reclaiming its resources.
3. Give the worker only its slice contract, relevant domain terms, nearby code and acceptance inputs. It implements and returns a structured result and usage, with no authority to declare its own acceptance.
4. Run required deterministic checks outside the worker. Run the required browser scenarios against the actual app. Missing required browser access is unverified, not passed.
5. Apply a bounded independent review to substantive changes. A retry receives the concrete failing check or review finding, not the entire conversation. Repeated identical failures exhaust the attempt budget and block that job; independent jobs may continue.
6. Integrate serially: rebase onto current staging, resolve and recheck the combined result, merge under the approved policy, then verify the staging deployment. Evidence from an older commit does not certify the integrated commit.
7. Release dependants only after their required dependency state is reached. Publish the product result when the entire required journey is accepted, or a concise blocker when a required job cannot progress.

Suggested ledger states: `planned → ready → claimed → building → verifying → reviewing → integrating → accepted`, with explicit `retry-wait`, `blocked`, `failed`, and `cancelled` outcomes. Deployment is a distinct recorded integration check. An adapter needs `start`, `status`, `cancel`, `result`, and `usage`; persist its external run ID before relying on polling.

Writes such as issue creation, branch publication and deployment need stable idempotency keys or reconciliation before retry. [Temporal's explanation of idempotency and durable execution](https://temporal.io/blog/idempotency-and-durable-execution) is relevant even if the first supervisor uses a local database instead of Temporal. Durable execution does not make a non-idempotent external action safe to repeat by itself.

## Scheduling and cost

Wave 0 lands schema, migrations, route shells and seeds. Feature jobs follow dependency order. Any job touching shared surface runs alone; only disjoint feature folders qualify for parallel work. Start serially until measurements show parallelism helps. Use a fresh integration check after each merge, since independently passing branches can still fail together.

Set per-job attempt and elapsed-time limits, a run budget, and maximum concurrency. Record actual provider token usage where available; mark missing usage unavailable rather than claiming exact savings. Cache research by source/date and product decision, and reuse stable artifacts by hash. Load only `/next`, its shared contract, and the active phase skill. Do not give every builder the full interview or all skill bodies.

Track cost per accepted slice, wall time to verified staging, retry reasons, escaped defects and human interventions. Prompt word reduction is a useful input metric; it is not evidence of equivalent token or monetary savings. Prefer deterministic checking to repeated LLM summaries of the same files.

## Delivery sequence and proof

| Increment | Observable acceptance |
|---|---|
| Job contract + serial local supervisor | Two dependent slices complete from pinned specs; a failing required check cannot mark a job accepted |
| One real worker adapter + persistence | Kill the supervisor mid-job, restart it, and recover without duplicate implementation, publication or lost results |
| Serial staging integration | Concurrent branch changes trigger rebase/recheck; deployed browser evidence identifies the integrated commit |
| Tracker projection + notifications | Restart/retry does not create duplicate issues; only meaningful completion/failure/input events notify |
| Parallel scheduling | Shared-surface jobs serialize; feature workers use isolated ports/data; cancelling one does not affect another |

Use a small synthetic product for these tests, including one intentionally failing slice and a changed requirement. Then repeat on a real engagement. Until the restart, stale-worker, combined-product and deployed-browser tests pass, describe the factory as supervised or experimental. A flawless outcome cannot be guaranteed by a skill rewrite; this evidence makes failures detectable and recoverable.
