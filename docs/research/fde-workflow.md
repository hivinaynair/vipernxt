# FDE process: understand first, code only after the reframe

Checked 2026-09-11. Palantir (origin), Varick, LangChain, HappyRobot, plus craft sources (The Forward Deployed, Vibe Engines, Perspective AI's 2026 function playbook). Shared finding: **operational context is the scarce input.** Code is cheap; the wrong problem is expensive. This kit already has salvage / field / shape / ontology / clip. The exit test it lacked: no product UI until you can name the **outcome number**, the **reframe**, and an **eval set of real cases**.

Dry-run this loop on throwaway clones. **Never write a live site into this repo.** Two shapes the loop must survive are in [fde-loop.md](../playbook/fde-loop.md) (incumbent replacement vs judgment-over-documents). Neither is a product here.

## What they actually do

| Firm | What an FDE is for | How they learn the problem | When they write code |
|---|---|---|---|
| **Palantir** (origin, 2005) | Embed, own data-to-decision, feed the platform. Not a systems integrator. | 5–10 conversations/week as *engineering work*. Ontology of the customer's nouns before the app. | "Ship on day one" — a working slice on **live data**, not a 90-day deck. AIP speedrun: ingest → transform → ontology → one Workshop action. ([Palantir FDSE](https://blog.palantir.com/a-day-in-the-life-of-a-palantir-forward-deployed-software-engineer-45ef2de257b1); [Foundry speedrun](https://learn.palantir.com/speedrun-your-first-e2e-workflow); [Perspective on Palantir](https://getperspective.ai/blog/palantir-forward-deployed-engineering-playbook-anthropic-openai-copying)) |
| **Varick** | Map the department, **redesign** the process, deploy agents **on** NetSuite/SAP/Salesforce. No migration. | Structured audit: interview process leads, undocumented exceptions, **dependency graph**. Internal FDE Agent synthesizes docs / flags missing edges. | After three buckets: **script / agent / human**. Sandbox → shadow → supervised production. 6–12 weeks discovery→production. ([Varick transformations](https://www.varickagents.com/blog/ai-transformations); [ZenML on Varick](https://www.zenml.io/llmops-database/scaling-forward-deployed-engineering-with-ai-agents-for-enterprise-transformation); [Moza, Applied AI](https://www.youtube.com/watch?v=l0FLhNqBOic)) |
| **HappyRobot** | Focused **missions** with a measurable outcome. Deployment *is* half the product. FDEs report to CTO, not sales. | Sit with operators. Split **semantic context** (entities = Twin) from **operational context** (judgment in people's heads). "You cannot scrape it." | After the mission is scoped. "Earn the right to do more." FDE builds; Deployment Strategist pushes back on one-customer habits. ([HappyRobot FDE](https://www.happyrobot.ai/blog/past-present-and-future-of-the-forward-deployed-engineer-at-happyrobot); [operational context](https://www.happyrobot.ai/blog/enterprise-superintelligence)) |
| **LangChain** | Co-architect **with** the customer's engineers. Technical win = POC + **evals**, not a slide. | Translate a vague workflow into a spec. Time-box the conversation (show the thing). | POC that is realistic, then **Agent Development Lifecycle**: traces → datasets → offline evals → production → failures back into the set. ([ADLC](https://www.langchain.com/blog/the-agent-development-lifecycle); [LangSmith evals](https://www.langchain.com/langsmith/evaluation)) |

Craft: request ≠ outcome; watch the worker; discovery is done when you can say **why the obvious build is wrong** ([The Forward Deployed](https://www.theforwarddeployed.io/own-the-outcome/discovery)). One success number; smallest e2e slice; assumptions dated, delays shift milestones day-for-day ([Vibe Engines](https://vibeengines.com/handbook/customer-discovery-and-scoping)). Function-level: discovery → prototype → deploy → **productize ≥1 thing back into the kit** → handoff; report to product/eng not sales; skip productize and you are a custom shop ([Perspective 2026 playbook](https://getperspective.ai/blog/the-forward-deployed-engineer-playbook-how-to-structure-run-and-scale-an-fde-function-in-2026)).

## Shared rules (encode these)

1. **Context is the bottleneck**, not models or CRUD. HappyRobot: operational context "has to be earned." Varick: "If the AI does not understand the underlying process, it will not create meaningful value." Palantir: LLM apps fail without a customer-specific ontology.
2. **The stated request is a proposed solution.** Climb to the number the buyer is measured on, then sit with the person who does the job. The veteran who never looks anything up is usually the real problem.
3. **Do not automate the current mess as-is.** Varick: rebuild; bucket steps script / judgment / human. Palantir: configure the platform, don't become Accenture. Buying Copilot seats is swapping the steam engine and keeping the factory layout.
4. **Semantic ≠ operational.** Entities in the SoR are not how the clerk actually decides. Ontology captures the first; journeys + laminated-card notes capture the second.
5. **A slice without a baseline is a demo.** Measure cycle time / error rate / holds *before* build. LangChain: last-N real cases become the eval set. Varick's first-workflow traits: volume, repeatable decisions, context spread across systems, measurable pain.
6. **Earn the right to expand.** HappyRobot. Palantir ships one decision workflow, then iterates. Do not spine the department.
7. **Refuse the custom shop.** Domain fact → product. One site's habit → workaround or no. Productize something back into *this kit* or you ran consulting.
8. **Shadow before replace.** Sandbox → shadow log next to the live process → supervised production. Especially before an agent posts to a ledger or issues a receipt.
9. **Evals replace vibes for judgment steps.** Offline: replay the eval set before a prompt/tool change. Online: traces of real runs, failures become new cases. Deterministic script steps stay `bun test`.
10. **Red flags, named early:** no problem owner, no success number, no path to the data, no champion. One is caution; several is a conversation, not a silent build ([Vibe Engines](https://vibeengines.com/handbook/customer-discovery-and-scoping)).

## Tools — layers, mapped onto this kit

Industry stack (2026 survey of Palantir / Anthropic / Harvey / Cohere-shaped FDE work) is four layers: **discover, build, deploy, iterate** ([Perspective FDE stack](https://getperspective.ai/blog/fde-tech-stack-2026-tools-forward-deployed-engineers-actually-ship)). Do not import that shopping list. Use what this repo already is:

| Layer | Field uses | This kit |
|---|---|---|
| Discover | Sit with the worker; photos; last-N cases; notes. (Granola/Otter for sync calls.) | `salvage` + `field-kit` + pile-reader. Inbox is the interview. Homework `.docx` is the trip. **Not** a kickoff form. |
| Model | Palantir Ontology; HappyRobot Twin (semantic vs operational) | `ontology.md` (semantic) + journey YAML (operational). Two files on purpose. |
| Bucket | Varick script / agent / human | Each journey step named as one of the three. No screen for a script step. |
| Eval | LangSmith / Braintrust / Inspect — last-N cases, traces, offline then online | `docs/research/eval-set.md`. Wave 0 seeds it. Judgment steps: replay harness (probe, not product UI). Script steps: `bun test`. Playwright traces for the clip. |
| Build | Cursor / Claude Code on the customer's repo | This playbook, `plan`/`build`, feature folders. |
| Runtime | LangGraph / durable workflow / human-in-the-loop pause | Vercel Workflows when a step is long-running or must pause for approval. Clerk for who may approve. |
| Deploy | Customer VPC or Vercel; n environments | Local clip first (`.env.local`). `setup.sh` after they accept. Neon staging + production. |
| Iterate | Prompt versioning, productization review | `check-drift`, journey IDs, `before-and-after`. A kit improvement that generalized from a dry-run **is** the productize gate. |

Foundry is Palantir-internal. Steal the *pattern* (ontology → one action on live data), not the product. Do not add LangSmith/Braintrust as a vendor until an engagement's judgment steps actually need a trace store — `eval-set.md` + a probe script is the default.

## Contested

**Ship on day one vs wait for a design doc.** Palantir rejects 90-day discovery decks. Our UI gate rejects product code before the claim. Both are right about different artifacts: Palantir's day-one ship is an **instrument on live data**, not a feature inventory. Resolution: allow a **probe** (replay of real cases, shadow log, baseline counter) before `shape` is done; keep the UI gate on `apps/*/src/app` and `src/features`.

**LangChain vs Varick/HappyRobot.** LangChain's DE is a platform co-builder inside the customer's eng team. Varick/HappyRobot embed in *operations*. This repo is the second job. Steal LangChain's eval discipline, not their pre-sales demo motion.

**Department-wide vs one clip.** Varick sells department transformation; HappyRobot sells missions. We take HappyRobot's "earn the right" for v1 and Varick's buckets so the clip is not a chatbot glued onto the old mess.

## Gaps vs the field (closing on this branch)

| Gap | Who has it | What we do now |
|---|---|---|
| Request → outcome number | Forward Deployed / Vibe Engines | U2 on `engagement.outcome`; idea paragraph is a claim |
| Reframe ("why the obvious build is wrong") | Forward Deployed | U5 `reframe:`; shape cannot be done without it |
| Last-N real cases as eval set | LangChain | `eval_set`; wave 0 seeds it; invented journeys are a defect |
| Script / agent / human | Varick | Named on every journey step |
| Operational context as its own model | HappyRobot Twin | Journeys + workaround list, not only entities |
| Shadow before replace | Varick | Probe, then clip beside the process |
| Earn-the-right scope | HappyRobot | Clip first; factory after they accept |
| Productize back to the kit | Perspective / Palantir Echo | Dry-run learnings land here as playbook, never as a site |
| Site vs FDE queues | implied by embed | `who: fde \| site` |

## Open

Whether a probe needs `ui_writes: allow` or a dedicated `apps/*/src/probe` path. Whether one `kind: decide` is enough Deployment-Strategist pushback. Varick's internal FDE Agent is this playbook; we do not clone their product.

Adopted loop: [docs/playbook/fde-loop.md](../playbook/fde-loop.md). Tool mapping: [docs/playbook/fde-tools.md](../playbook/fde-tools.md).
