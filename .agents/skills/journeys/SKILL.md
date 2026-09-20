---
name: journeys
description: >-
  Turns confirmed user journeys into an ID'd spine (YAML) that screens,
  features, plans and tests can cite, then generates the Mermaid diagrams and
  tables from it. Use after a product design doc exists, when the user asks to
  map journeys, map a feature's journey, add a screen or state, cut features
  from journeys, regenerate journey diagrams, or fix an expansion that does
  not match the design-doc table. If the product story itself is wrong, /next
  reopens shape first — this skill does not invent a new clip.
---

# Journey spine

Input: approved design Actors, numbered Clip, Journeys table, Screens. Output: `docs/journeys/<name>.yaml` (markdown is generated). Follow [CONTRACT.md](../CONTRACT.md). Schema: [spine-schema.md](spine-schema.md). Examples: [screens](example.yaml), [headless](example-wrap.yaml).

## Expand

1. One journey per accepted seat; one stable ID per beat (`J1.S1`). Do not invent an actor, click or promise.
2. Tag `script | judgment | human`. Interactive steps name a declared screen/state. `sees`/`does` are observable.
3. `next` follows the accepted story. Distinct outcomes use `{to, when}`. Terminals name one exit if exits are declared.
4. Behavioral EARS only (`WHEN`/`IF … THE SYSTEM SHALL …`). Result, not click script. Every implemented step needs criteria.
5. Cut features as modules serving step IDs.

Validate/render with `bun scripts/journey.ts` (`validate`, `render --out`). Independent check: `spine-checker`. Faithful expansion of approved content returns to `/next` with no extra gate.

Reconcile [data-surfaces.md](../shape/data-surfaces.md) to step IDs. Keep the inventory in the contract, not the YAML. Missing information requirements return to shape/plan.

## Stable IDs

Never hand-edit generated markdown, renumber to close gaps, or reuse a retired ID. Insert `J1.S2b`. Same meaning keeps its ID. Wrong story → shape; wrong expansion → YAML only. Tests cite step IDs. `check-journeys` is citation coverage, not behavior proof.

EARS cannot decide AI. Use deterministic code when a known rule covers the input. A model needs measured quality, abstention and a deterministic gate. Never add an agent because a step is labeled judgment.
