# Build the Cursor adapter first; keep product decisions and acceptance portable

Research checked 2026-09-14. This is our design choice for a solo company, not a claim that the referenced projects implement identical systems.

## What to borrow

| Source | Useful idea | ViperNxt application |
|---|---|---|
| [Factory Missions planning](https://docs.factory.ai/missions/planning) | Agree features, order and validation milestones before running workers | Local research, customer homework, design and journey acceptance produce bounded tickets. Review the first slice before releasing the remaining scope. |
| [Factory Agent Readiness](https://docs.factory.ai/agent-readiness/overview) | Fix the repository's execution environment before demanding autonomy | A fresh clone must install, start, seed, test and build with documented commands. Missing commands are infrastructure work, not something every feature agent should rediscover. |
| [Factory automated QA](https://docs.factory.ai/software-factory/automated-qa) | Test affected user flows and capture evidence | Pin acceptance scenarios; use browser receipts tied to the tested candidate. Keep a regression case when a real failure reveals a gap. |
| [Symphony specification](https://github.com/openai/symphony/blob/main/SPEC.md) | Separate workflow policy, scheduling, workspace management and agent execution | Keep approved tickets and checks independent of Cursor API details. Persist remote identities and reconcile uncertain outcomes before retrying. |
| [Symphony introduction](https://openai.com/index/open-source-codex-orchestration-symphony/) | Manage work and review outcomes instead of supervising every agent action | Queue authorized slices, inspect exceptions and review a working milestone with evidence. |

For one person, prioritize reproducible setup, small tickets, reliable verification and bounded repair. Measure accepted slices, repair attempts, elapsed time, review findings and provider spend when available. Lines generated and agent count are poor measures of product progress. Keep worker context to the current ticket, cited specs, relevant code and the last failure. Do not attach the entire discovery conversation to each run.

## Sandcastle: execution boundaries and reusable environments

[Sandcastle](https://github.com/mattpocock/sandcastle) separates agent providers from sandbox providers, supports explicit branch strategies and lifecycle hooks, and returns structured run results. Borrow that boundary: the ticket should describe work; the execution adapter should own environment setup, cancellation and result collection. Keep installation scripts reusable and preserve failed workspaces for diagnosis.

Its separate idle and post-completion timeouts address different failure modes. That is useful future hardening for our local CLI worker; our current cloud adapter uses a wall-clock deadline and terminal API state. Do not treat a completion phrase as product acceptance. Structured-output repair should target the malformed report rather than rerunning implementation. The current factory blocks uncertain remote work and bounds ordinary repair; richer format-only repair is not implemented yet.

We do not need to install Sandcastle to use Cursor's hosted environments. Adopt a sandbox library when we need to run another CLI in infrastructure we manage. This keeps the first cloud path small.

## Local decisions, cloud implementation

1. Locally: validate the problem with another person, gather workflow evidence, agree scope, design journeys and scaffold the selected stack.
2. Prepare a dedicated product GitHub repository and a reproducible cloud development environment. GitHub access is needed before the first cloud implementation; production infrastructure can still wait.
3. Cursor implements one approved first slice. Verification runs on the controller host; the first slice stops at `awaiting-review`.
4. After acceptance, release the remaining pinned ticket set. Cursor builds; separate review and deterministic checks decide acceptance; the supervisor integrates serially.
5. A configured delivery adapter verifies staging. Review the resulting product and convert changes into another bounded batch.

Symphony is an execution specification, not a replacement for discovery, design or customer validation. We borrow its separation of concerns; we are not claiming Symphony compatibility. Our current queue is a sealed repository manifest, not a live Linear reader. Linear can present tickets, but an edited issue must not silently rewrite an already approved execution contract.

## Cursor first, narrow portability

Implement one production provider, Cursor Cloud. Keep the manifest's journey IDs, dependencies, scope and checks portable; put authentication, launch, polling, cancellation and result retrieval in one module. Retain the existing local adapter for offline use. Add another cloud provider only when a concrete need justifies it.

The [Cursor v1 API](https://cursor.com/docs/cloud-agent/api/endpoints) currently uses durable agents plus runs and is in public beta. Persist a client-supplied agent ID before creation; reconcile it after a lost response. A completed run is only a candidate. Fetch its branch from the explicit product repository, verify ancestry and scope, then run acceptance checks. Ambiguous cancellation blocks new work. Use a fresh agent for an independent review.

Cloud workers do not make a laptop-hosted controller always available. Run the controller on one always-on POSIX machine with a persistent checkout and ledger to dispatch all night. Current persistence is single-host; automatic host failover, live Linear reconciliation and parallel cloud waves are future work. Cursor's MCP integrations do not supply this controller's API credential. Configure `CURSOR_API_KEY` on that host and provider spending limits separately.
