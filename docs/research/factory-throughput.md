# Factory throughput — what the evidence says

Researched 2026-09-12 for the F phase. Findings first, each cited. Where this
contradicts what the kit does, the contradiction is named.

## F1 — The bottleneck is the review queue, not authoring and not merging

| Measure | Value | Source |
|---|---|---|
| Wait before a reviewer picks up an AI-generated PR | **4.6× longer** than human PRs | Faros AI 2026 benchmarks |
| Review itself, once started | **2× faster** | same |
| Net effect on cycle time | barely improves | same |
| Median PR review time | **+441%** | AI Engineering Report 2026 |
| PRs merged with no review | **+31%** | same |
| Meta: share of diff growth from agentic AI | **>80%**; diffs/dev/month +51% | Meta eng., via DX |

Review completes quickly once a human starts. **The queue is the problem, not the
reading.** Adding reviewers or asking for faster review does not fix a queue.

**For this kit:** keeping the human out of the per-PR loop — one mandatory
checkpoint at the first slice, then auto-merge on evidence — is the correct
shape, and the thing to protect. Do not add per-PR human review to the factory.

## F2 — Agent PRs conflict often enough that isolation must be structural

**27.67%** of AI-agent pull requests hit merge conflicts: 142,000+ PRs across
59,000+ repositories, 336,000+ conflict regions (AgenticFlict, AIware '26,
arXiv 2604.03551).

**For this kit:** feature folders plus `check-boundaries` are not hygiene, they
are the mechanism. But `build/SKILL.md:40`'s scope check — each agent runs
`gh pr list` / `gh pr diff --name-only` and stops if it sees a clash — is
optimistic concurrency with a check-to-write window, run independently by five
agents. At a ~28% base rate it will miss. Isolation should be structural
(worktrees, one lock on shared surface), not advisory.

## F3 — AI raises throughput *and* instability; small batches is the amplifier

DORA 2025: AI adoption now correlates positively with delivery throughput —
and continues to correlate with **higher instability**: more change failures,
more rework, longer recovery. The stated cause is volume — code is generated
faster than review and deploy infrastructure absorbs it. Working in small
batches is what converts AI throughput into product performance; teams abandon
it precisely because generation is cheap.

> Without robust control systems — strong automated testing, mature version
> control, fast feedback loops — an increase in change volume leads to
> instability. (DORA 2025)

**For this kit:** the control systems exist (merge bar, boundaries, tokens,
journey IDs, eval score). What is missing is a **cap on slice size**. Nothing in
`plan` or `build` bounds a slice's diff, and generation being cheap is exactly
the pressure DORA says teams give in to.

## F4 — The industry moved the quality gate from the diff to the plan

| Who | Practice |
|---|---|
| GrowthX | Review the **spec in markdown before implementation**; tests carry the contract at merge |
| Anthropic | Review the **generator**, not each output |
| Stripe | Cap agent iterations at **two CI runs**, then a human |
| Fin / Intercom | Auto-approve small PRs; **scope rules force breakdown** of large ones |
| Figma | **Two AI models** review every PR; human adjudicates disputes |
| Cloudflare | Agent work ships behind **feature flags** by default |

**For this kit:** this is convergent validation. The design doc and the journey
spine, approved before any product code, *are* plan review — and tests named for
the step they prove are the contract carried to merge. The kit arrived here
first and should say so.

Three of the six it does not do: no slice-size scope rule, no second reviewer,
**no feature flags** — nothing can merge hidden, so every slice must be
complete and correct on the way in.

## F5 — Merge queues partition by impacted target

A merge queue tests each PR against the **future state** of the trunk rather
than its own stale base. Parallel queues split by impacted target — frontend
does not wait on backend — and tuned queues are reported at **2–5× safe merge
throughput** (Trunk.io; Mergify).

**For this kit:** `src/features/<slug>/` is already exactly that partition, and
the boundary rule guarantees it is sound. The kit currently rebases by hand
(`build/SKILL.md:45`) and auto-merges on green after the last push, which is a
weaker version of the same idea.

## F6 — Stacked PRs separate merge cadence from review unit

GitHub shipped stacked pull requests in July 2026. The argument is not
dependency management — it is that a stack lets one large change be reviewed as
several ordered small ones without waiting for each to merge.

**This contradicts the advice given before this research**, which rejected
stacking as a workaround for bad decomposition. That reasoning was about
dependencies; the actual case is batch size (F3), which is a stronger argument.

## Open

- No source found on whether **route/shell files** should be pre-created to keep
  agents out of shared surface. That remains reasoning, not evidence.
- Single-sourced, treat as soft: the +51% PR size and +54% bugs/PR figures.

## Sources

AgenticFlict, arXiv 2604.03551 (AIware '26) · DORA 2025 State of AI-assisted
Software Development (dora.dev, Google Cloud) · Faros AI 2026 engineering
benchmarks · AI Engineering Report 2026 · getDX (Brian Houck; Meta data) ·
Trunk.io merge queue docs · Mergify, trunk-based development · daniellopes.dev,
"Trunk-based development, feature branches, and what teams running agents
actually do"
