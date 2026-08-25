---
name: journeys
description: >-
  Turns confirmed user journeys into an ID'd spine (YAML) that screens,
  features, plans and tests can cite, then generates the Mermaid diagrams and
  tables from it. Use after a product design doc exists, when the user asks to
  map journeys, map a feature's journey, add a screen or state, cut features
  from journeys, or regenerate journey diagrams.
---

# Journey spine

Every journey step gets a stable ID. That ID is how a screen, a feature, a plan
and a test all refer to the same moment. Without IDs a journey is a picture
someone drew once; with them it is the index for the whole product.

```
docs/journeys/<name>.yaml   source of truth — hand-written
docs/journeys/<name>.md     generated — never hand-edited
```

Schema: [spine-schema.md](spine-schema.md). Worked example: [example.yaml](example.yaml).

## Hard rules

- **The YAML is the source. The markdown is output.** Never edit the `.md`. If it
  is wrong, the YAML is wrong.
- **IDs are permanent.** `J1.S2` means the same moment forever. Insert `J1.S2b`,
  or append `J1.S7`; never renumber to close a gap. Renumbering silently breaks
  every plan and test that cited the old ID.
- **Validate before you show anything.** `bun scripts/journey.ts validate <file>`
  exits non-zero on a broken spine. A spine that does not validate is not a spine.
- **Criteria are EARS.** `WHEN <trigger> THE SYSTEM SHALL <behavior>`, or
  `IF <condition> THE SYSTEM SHALL <behavior>`. One behavior per line. These
  become test names later, so write them as behavior, not as UI script.
- **EARS is also the AI test.** If a step's behavior can be written as
  `WHEN … THE SYSTEM SHALL …`, it does not need a model — write the code. If it cannot,
  either the step is not understood yet (usually), in which case go back and find out, or
  it is genuinely fuzzy — free text in, judgment out — in which case a model is a
  candidate and its output still needs a deterministic check before anything irreversible
  happens. AI belongs at the edges, where unstructured input arrives and natural language
  leaves. Never in the middle, where money and obligations are decided.
- **One question per message** when something is genuinely undecided, with a
  recommendation. Do not interview for things the design doc already settled.
- **Do not invent journeys the design doc has not confirmed.** This skill
  transcribes and sharpens; it does not shape. If the product is still uncertain,
  use the `shape` skill first.

## Workflow

### 1. Read the source

Find the design doc (`docs/plans/*-design.md`). Read its actors, clip, journeys
and screens sections. The spine's `source:` field points back at it.

No design doc? Ask one question: shape the product first (the `shape` skill), or
draft a spine from what they tell you now and accept it is unconfirmed.

### 2. Draft the spine

Transcribe into `docs/journeys/<name>.yaml`:

- **actors** — from the doc's actor table.
- **screens** — one per screen the journeys touch, with its `bands` and the
  `states` it can be in. States matter: most bugs live in the states nobody drew.
- **journeys** — one per actor goal. Steps in narrative order, each with what the
  actor `sees` and `does`, the `screen` + `state` it happens on, and `next`.
- **criteria** — EARS lines per step. This is the step that turns a journey into
  something buildable; do not skip it because it feels like paperwork.

A step with no `next` is terminal. Branches are a list: `next: [J1.S4, J1.S5]`.

### 3. Validate and render

```bash
bun scripts/journey.ts validate docs/journeys/<name>.yaml
bun scripts/journey.ts render   docs/journeys/<name>.yaml --out docs/journeys/<name>.md
```

Fix every error. Warnings are advice — a step with no criteria is usually a step
nobody has thought through, but an intentionally passive step is fine.

### 4. Cut features from steps

A feature is a set of journey steps that ship together:

```yaml
features:
  - id: F2
    title: Reconciliation view
    serves: [J1.S3, J2.S1]
```

The render lists any step no feature serves yet. That list is your v1 scope
conversation — the **walking skeleton** is the thinnest set of features that
still gets one actor from their first step to a terminal one.

**A feature is a module, not a label.** Name it so it works as a directory: `F2
Reconciliation view` becomes `features/reconciliation/`, and later a Linear ticket.
One name, three places.

That makes the feature cut an architectural decision, not bookkeeping. If two features
turn out to need each other's internals, the boundary check will say so — and that is a
signal the journey cut is wrong, not that the rule is inconvenient. Either the two are
one feature, or what they share belongs in shared code. Re-cut the spine rather than
reaching across the boundary.

### 5. Show it and confirm

Show the rendered markdown (the Mermaid flowchart is the part people react to).
Ask one question: is this the journey, or which step is wrong?

Patch the YAML, re-render. Never patch the markdown.

## Handing off to feature work

Each feature in the spine is the unit the feature-tier skills consume. When a
feature enters `worth-it`, `nah-fam`, `game-plan` or `lets-cook`, it carries its
step IDs, and the plan cites them:

```
F2 Reconciliation view — serves J1.S3, J2.S1
```

The acceptance criteria on those steps are the feature's acceptance criteria.
They are already written; do not rewrite them from scratch in the plan.

## Keeping it alive

Building teaches you things the spine did not know. When that happens, change the
spine **first**, then the code — it is a two-line YAML edit and a re-render.

Be honest about the failure mode: a spine nobody regenerates is a stale diagram.
The render step is cheap on purpose. If it stops being run, the spine is dead and
should be deleted rather than trusted.
