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

Read `docs/product/state.yaml` first, then [the execution contract](../CONTRACT.md). This is the only user-facing entry point; load one phase skill when needed, return here, update state and continue until the next genuine user decision. Schema: [state-schema.md](state-schema.md).

## Entry

| Request | Route |
|---|---|
| Small change | Do the change; no discovery ceremony |
| Feature in an accepted product | Extend the existing spine, then plan/build |
| New idea, including self-use | Find another named person with the problem; category research may run meanwhile |
| Named person/customer and existing workflow | Engagement: salvage → research/field → shape → first slice |

Record `size: engagement` for both idea intake and customer work; “idea” is not a separate state value. Finding another person validates a discovery participant, not market demand. FDE depth depends on how much of their actual workflow, environment and adoption you own.

No state file: create it from the schema with `clone.customized` and `clone.scaffolded: pending`, `clone.setup` and `clone.tickets: deferred`. Record who has the problem and what they use today. Ask for existing material only if missing: local `docs/research/salvage-inbox/`; remote transcripts plus INVENTORY.md, or one zip of originals. Run `bun scripts/salvage-inbox.mjs <inputs>`; see [pile checklist](../salvage/pile.md). Do not put engagements in the reusable kit.

## Progression

| Step | Skill/output | Exit condition |
|---|---|---|
| 0 Salvage | `salvage`; facts from current tools and supplied material | Incumbent and current paid capabilities checked; no unchecked “paper” premise |
| 1 Research | Decision-relevant primary sources; `before-we-build.md` | Unknowns that change scope named; settled choices not reopened |
| 2 Field | `field-kit`; on-site, pile or trip | Workflow, exceptions, baseline and eval cases sourced; accepted assumptions explicit |
| 3 Shape | `shape`; approved design | U5: outcome, affected person, real problem, why obvious build is wrong, safe fallback |
| 3.5 Ontology | `ontology` | Domain entities/actions/vocabulary; unresolved surprises confirmed |
| 4 Journeys | `journeys` | Valid ID'd expansion of accepted beats, EARS and feature mapping |
| Scaffold | `customize` → `scaffold` script | Chosen stack configured and verified; no cloud prerequisites for local clip |
| 5a Structure | `design-system` | Minimal layout/state primitives before first product screens |
| 6 First slice | `plan` → `build` | Wave 0 + one working journey, tests and eval evidence; user reviews it |
| Factory | Setup, Linear, remaining planned slices | Accepted scope integrated and verified as a combined product |

Research and field may overlap. Shape may draft while gaps remain, but cannot be done on unaccepted assumptions. The first design review and first working slice are product decisions; mechanically expanding approved content is not another approval gate.

U1–U5 detail and optional later generalization: [fde-loop.md](../../../docs/playbook/fde-loop.md). The last ten real cases are a starting eval set, not a statistical guarantee. Record baseline before an incumbent upgrade makes it unrecoverable. Do not report synthetic cases as real outcomes. Keep the incumbent as fallback; judgment systems propose before they can post.

## Build and resume

Run `bun scripts/check-drift.ts` before building; disclose findings and repair actual inconsistencies within scope. Wave 0 owns schema, seed, route shells and initial layout. `bun scripts/journey.ts routes <spine>` lists shells. Schema covers the next slice, not speculative future tables. Seed fixed IDs/dates from the eval set before feature work.

Missing local DB keys do not block: PGlite runs locally. Use `bun run db generate`, `bun run db migrate`, `bun run --cwd packages/db db:seed`; stop the dev server before DB scripts. Reset only the disposable local DB when appropriate. Clerk keyless development requires its wiring; package installation alone is not verification.

After slice acceptance, record `clip.acceptance: accepted`, its `acceptance_decision` and `evidence` artifact, set setup/tickets pending when applicable, and perform already-authorized provisioning. Build remaining slices in dependency order. Shared surfaces run alone; isolated feature slices may run concurrently only with exclusive ownership. Serial integration must verify the combined product. The factory design is [factory.md](../../../docs/playbook/factory.md); do not claim an unattended supervisor is running unless one actually is.

When a story changes: revise the design clip/table, re-expand the same spine and preserve IDs for unchanged moments. Reopen shape only when the claim changes; otherwise reopen journeys. Never reuse a dropped ID for another meaning. Sync tickets when enabled. A parked/buy-instead outcome has a reason and date.

## Child work and cost

Delegate only an independent question/source or a disjoint planned slice. Give the child the relevant skill, inputs, allowed paths, evidence question and output limit—not all project history. Use salvage-miner, pile-reader, domain-researcher, spine-checker or ui-gate-auditor as appropriate. Cursor uses matching adapters; other hosts use available subagents/sibling workers, or run serially. Missing a vendor-specific harness is not a reason to skip the job.

Start with a few useful sources; expand only for a decision-changing gap. Cache source/date/decision links. Report one consolidated result. Stop a slice for an unsettled product choice, absent schema dependency, two failed verification/repair rounds, or recurring same-theme corrections; keep independent work moving.
