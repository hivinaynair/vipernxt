---
name: next
description: >-
  The single entry point for an FDE engagement — site, pile, clip, then the
  factory. Reads pipeline state, does every step that does not need a human, and
  stops only to hold an item. Use when they say "next", name a site, drop a pile,
  resume shaping, answer a held question, say the journey is the wrong story, or
  name a feature to plan and build.
---

# next

Read `docs/product/state.yaml`, then [CONTRACT.md](../CONTRACT.md). This is the only user-facing entry; load one phase skill, return here, update state, continue until a real user decision. Schema: [state-schema.md](state-schema.md). Phase detail: [fde-loop.md](../../../docs/playbook/fde-loop.md).

## Route

| Request | Action |
|---|---|
| Small change | Do it. No discovery ceremony. |
| Feature in an accepted product | Extend the spine, then plan/build. |
| New idea, including self-use | Find another named person with the problem. |
| Named person + existing workflow | Engagement: salvage → field/research → shape → first slice. |

`size` is always `engagement`. Finding another person validates a participant, not market demand. FDE depth is how much of their actual workflow you own.

No state file: create it from the schema with `clone.customized` and `clone.scaffolded: pending`, `clone.setup` and `clone.tickets: deferred`. Record who has the problem and what they use today. Ask for existing material only if missing (`docs/research/salvage-inbox/`, transcripts + INVENTORY.md, or one zip). Run `bun scripts/salvage-inbox.mjs <inputs>`; see [pile.md](../salvage/pile.md). Do not put engagements in this kit.

## Progression

| Step | Skill | Done when |
|---|---|---|
| 0 Salvage | `salvage` | Incumbent and paid capabilities checked |
| 1 Research | primary sources; `before-we-build.md` | Scope-changing unknowns named |
| 2 Field | `field-kit` | Workflow, exceptions, baseline, eval cases sourced |
| 3 Shape | `shape` | U5 accepted |
| 3.5 Ontology | `ontology` | Domain terms confirmed |
| 4 Journeys | `journeys` | ID'd spine |
| Scaffold | `customize` | Recipe applied; no cloud needed for a local clip |
| 5a Structure | `design-system` | Layout primitives before screens |
| 6 First slice | `plan` → `build` | Wave 0 + one working journey; user reviews it |
| Factory | Eve | Remaining approved scope integrated and verified |

Research and field may overlap. Shape may draft with gaps; it cannot finish on unaccepted assumptions. The first design review and first working slice are product decisions. U1–U5, eval-set rules, and incumbent-as-fallback live in [fde-loop.md](../../../docs/playbook/fde-loop.md).

## Resume

Input/data-display work needs the reviewed [data-surface contract](../shape/data-surfaces.md). Stack, wave 0, and isolation: AGENTS.md. Drift: `bun scripts/check-drift.ts`. After clip acceptance, record `clip.acceptance`, then authorized setup. Factory: [factory.md](../../../docs/playbook/factory.md) and [Eve](../../../deploy/eve/README.md) — do not claim an unattended supervisor unless one is running.

Story change: revise the design clip/table, re-expand the same spine, keep IDs. Reopen shape only when the claim changes. Never reuse a dropped ID.

## Children

Delegate one independent source or one disjoint planned slice. Give the child its skill, inputs, allowed paths, evidence question and output limit. Cursor uses the Grok adapters; otherwise run serially. Stop a slice for an unsettled product choice, missing schema dependency, two failed repair rounds, or the same-theme corrections.

Discovery stays local. Cloud implementation uses Eve and a chosen product repo; MCP is not a Cursor API key. After they authorize remaining scope, pin the MVP catalog ([COVERAGE.md](../../../deploy/eve/COVERAGE.md)), open a factory-labeled issue, and confirm the workflow — dispatch is not completion. The local `factory` CLI is a development runner.
