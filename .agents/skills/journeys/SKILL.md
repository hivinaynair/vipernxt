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

Input: approved design doc's Actors, numbered Clip, Journeys table and Screens (if interactive). Output: `docs/journeys/<name>.yaml`; its markdown is generated. Follow [execution contract](../CONTRACT.md). Load [schema](spine-schema.md) when authoring; examples: [screens](example.yaml), [headless wrap](example-wrap.yaml).

## Expand accepted behavior

1. One journey per accepted seat row; one stable ID per meaningful beat (`J1.S1`). Do not invent an actor, click or product promise.
2. Tag every step `script | judgment | human`. Interactive steps name a declared screen/state; headless or out-of-band steps need no screen. `sees`/`does` describe observable behavior.
3. `next` follows the accepted story. Distinct outcomes use labeled `{to, when}` edges. If declaring journey exits, each terminal step names one. A reused multi-step opening can use a reusable journey; do not abstract one shared step for style.
4. Give behavioral criteria in EARS (`WHEN`/`IF … THE SYSTEM SHALL …`). Criteria describe the result, not an implementation or click script. All implemented steps need criteria, including model-assisted ones.
5. Cut features as coherent modules serving step IDs. If two features require each other's internals, reconsider the boundary or shared contract.
6. Validate and render before review:

```sh
bun scripts/journey.ts validate docs/journeys/<name>.yaml
bun scripts/journey.ts render docs/journeys/<name>.yaml --out docs/journeys/<name>.md
```

Show the diagram; ask only about unresolved or newly introduced behavior. Faithful mechanical expansion of approved content returns to `/next` without another permission gate. Use `spine-checker` for an independent structural check when useful.

Before returning, reconcile `docs/product/data-surfaces.md` with the spine: resolve design beat references to stable step IDs, account for each in-scope form/table/detail view, and carry material rules into EARS or linked acceptance cases. Keep the detailed inventory in the contract, not duplicated in YAML. Missing information requirements return to shape/plan before implementation; mechanical ID mapping does not reopen approval.

## Stable contract

Never hand-edit generated markdown, renumber to close gaps or reuse a retired ID. Insert `J1.S2b` for a new moment. Same meaning keeps its ID. A wrong product story returns to shape's clip/table; a wrong expansion changes YAML only. Remove dropped steps from serves and retire dependent citations/tickets together.

Tests cite step IDs. `bun run check-journeys` checks real IDs per slice; `--complete` at clip completion checks served criteria have test citations. Citation coverage is not proof of behavior: test actual outcomes and browser paths.

## AI choice

EARS syntax cannot determine whether AI is needed. Choose deterministic code when a known rule/algorithm covers the input. Consider a model for genuinely uncertain interpretation, with measured quality/cost, abstention and a deterministic output gate. Keep accountable human approval for consequential writes. Never add an agent merely because a step is labeled judgment.
