---
name: salvage
description: >-
  Mines whatever already exists in the domain — an earlier build, the software or
  spreadsheet being replaced, competitors, public complaints — for domain facts,
  and records what was built and did not survive. Use at the start of any new
  product, not only when there is an old repo to read.
---

# Salvage prior art

Input: named participant, current workflow/tool, supplied material and relevant alternatives. Output: `docs/research/salvage.md` under [artifacts](../artifacts/SKILL.md). Follow [execution contract](../CONTRACT.md).

## Read the current job

Verify what runs it today: vendor/tool name, who uses it, whether transactions actually pass through it, and what the current paid version already provides. Ask only for inaccessible site facts; find vendor capabilities yourself. Record corrections to the original premise. If an upgrade is imminent, capture baseline numbers before it changes the workflow.

Start with the incumbent, supplied prior build/pile and one or two meaningful alternatives. Inspect pricing, recent changes, support complaints and relevant 2–3-star reviews. Expand only for a decision-changing unknown. Complaints reveal hypotheses, not prevalence. Buy/upgrade can be the outcome, but compare fit, total cost and constraints rather than stopping at feature overlap.

Mine **facts, not structure**: fields actually used, state transitions, exceptions, artifacts and workarounds. Do not copy a menu, navigation tree or feature matrix. A prior build's schema and repeated migrations can reveal domain learning. Empty/abandoned fields also count as evidence.

For files/photos, use [pile.md](pile.md) and the normalizer. Originals stay private; transcripts preserve source labels, values and uncertainty. Delegate independent named sources to `salvage-miner`, pages to `pile-reader`, with narrow inputs/output limits; run serially if no worker mechanism is available.

## Output

| Section | Content |
|---|---|
| Facts | Claim + exact path/commit/URL/photo reference |
| Vocabulary | Domain terms and ambiguity |
| Entities/states | What evidence supports, including exceptions |
| Abandoned work | What existed, evidence it was abandoned, known cost; no prohibition on the new product |
| Open questions | What only field research or the product decision can settle |

Shape decides scope later. Do not turn abandoned features into “never build” rules, vendor layouts into requirements or printed fields into legal obligations. If nothing is accessible, list what was attempted and return the actual gap instead of manufacturing a report.
