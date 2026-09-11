# FDE tools (this kit)

What an FDE actually opens, mapped onto ViperNxt. Citations: [fde-workflow.md](../research/fde-workflow.md). Procedure: [fde-loop.md](fde-loop.md).

Do not add a vendor because a 2026 stack blog named it. Add one when a dry-run proves a layer is empty.

| When | Open this | Not this |
|---|---|---|
| New engagement | `/next` → pile at `docs/research/salvage-inbox/` (or attach in cloud) | A kickoff deck, a Typeform, a Notion PRD as source of truth |
| Parallel job | `/skill:salvage-miner` in a sibling (Cursor Task, Pi pane, serial here) | A folder no harness scans; skipping miners because this isn't Cursor |
| What they use today | Folder on disk, or cloud: transcripts / one zip | Forty files in chat, a Drive link, their idea paragraph |
| Market after U1 | Pricing, changelog, 2–3★ of 2–3 named competitors | A feature matrix / scraping their menu into a backlog |
| Last 10 cases | `docs/research/eval-set.md` (anonymized) | Invented seed people |
| Semantic model | `docs/product/ontology.md` | Table names you find convenient |
| Operational model | `docs/journeys/*.yaml` with `bucket: script \| judgment \| human` | Ontology entities pretending to be the clerk's judgment; a fake screen on a script step |
| Script step | `bun test`, a workflow, an API call | A screen, an agent |
| Judgment step | Probe replay on the eval set; human-in-the-loop before the SoR write | Untraced prompt in a route |
| Human-only step | Leave it with the person; log that it happened | "AI assist" chrome |
| Clip UI | One journey, seeded with the eval set | The incumbent's full menu |
| Compose the stack | `bun scripts/compose.mjs --add web` (recipe + overlays). CLIs first, then `--apply`. | A second GitHub template; free-hand `create-next-app`; overlay copy before the CLI |
| Hosted preview | `setup.sh` after they accept the clip (`NEON_REGION` for EU/Asia) | Provisioning before U5; a per-region template repo |
| Kit improvement | A playbook/script change with no site name | Copying a customer's ontology into this repo |

**Durable execution.** If a step must pause for a human (approve a posting, confirm a receipt), that is Vercel Workflows, not a long Server Action.

**Traces.** Playwright traces prove the clip. Judgment probes need input → tool calls → output on the eval set. Promote a trace store (LangSmith or similar) only when the eval set no longer fits a markdown file plus a test.
