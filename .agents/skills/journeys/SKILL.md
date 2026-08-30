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

Every journey step gets a stable ID. That ID is how a screen, a feature, a plan
and a test all refer to the same moment. Without IDs a journey is a picture
someone drew once; with them it is the index for the whole product.

```
docs/journeys/<name>.yaml   source of truth — hand-written
docs/journeys/<name>.md     generated — never hand-edited
```

Schema: [spine-schema.md](spine-schema.md). Worked example: [example.yaml](example.yaml).

You do not need W3C UJG words. You need the design doc's tables and this expansion.
Write our YAML keys (`step`, `next`, `sees`, `does`). Do not invent a second format.

## How to read, then write

`shape` leaves four things in `docs/plans/*-design.md`. Read all four before typing
YAML. If a section is missing, stop — run `shape`, or ask one question.

| In the design doc | What you take from it |
|---|---|
| **Actors** | `actors[]`. One id per seat. |
| **The clip** | Numbered beats. These become steps for the seat the clip is about. |
| **Journeys** | One row per seat: wants / can click / sees after beat 1 / sees at the end. Each row is one journey (`J1`, `J2`). |
| **Screens** | `screens[]` — `bands` and every `state`. A step lands on one screen + one state. |

Do not invent a seat, a beat, or a click the doc did not confirm.

### Expand a row into steps

1. **One journey per table row.** Same clip, two seats → `J1` and `J2`, not one graph
   with both voices.
2. **A step is a turning point they can see.** Clip beat 1 → `J1.S1`, beat 2 → `J1.S2`.
   Two clicks that leave the picture unchanged stay one step. `sees` and `does` come
   from the row plus that beat. `screen` + `state` come from the Screens table.
3. **`next` is the next beat.** Linear clip: `next: J1.S2`. The doc names two
   outcomes (supported vs refused file): label the edges. Do not fork because you
   can imagine a failure.
   ```yaml
   next:
     - { to: J1.S3, when: supported file }
     - { to: J1.S2b, when: unsupported format }
   ```
4. **Two endings the product must tell apart** → journey `exits:` and the terminal
   step names `exit:`. One quiet payoff: omit `exits:`.
5. **The same opening copied twice** → extract a small journey and `uses:` it.
   One shared step is cheaper to write twice. Do not nest for style.
6. **EARS on each step**, then cut `features` from steps. IDs never renumber
   (`J1.S2b` to insert).
7. **Validate, render, ask.** Show the Mermaid. One question: is this the journey,
   or which step is wrong?

### From this doc, write this YAML

Design doc (read):

```markdown
## The clip
1. Lands on an empty dashboard
2. Drops a CSV
3. Sees the balance match

## Journeys
| Seat | Wants | Can click | Sees after beat 1 | Sees at the end |
| Owner | One reconciled ledger | New ledger, drop CSV | Empty dashboard, one action | Matched total |
| Reviewer | Question one row | Flag, leave a reason | Same ledger, no mutate | Flag visible to owner |
```

Spine (write): Owner row + three clip beats → `J1.S1`–`J1.S3`. Reviewer row →
`J2` (their clicks are not the owner's clip). Full file: [example.yaml](example.yaml).

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
  transcribes and sharpens; it does not shape. If the **story** is wrong — wrong
  clip, wrong seat, they want a simpler path — stop and let `/next` reopen
  `shape` on the journeys table. Do not “fix” the YAML into a product the doc
  does not describe.

## Workflow

### 1. Read the source

Find the design doc (`docs/plans/*-design.md`). Read its actors, clip, journeys
and screens sections. The spine's `source:` field points back at it.

No design doc? Ask one question: shape the product first (the `shape` skill), or
draft a spine from what they tell you now and accept it is unconfirmed.

### 2. Draft the spine

Follow **How to read, then write**. `docs/journeys/<name>.yaml`:

- **actors** — from the Actors table.
- **screens** — from the Screens table. States matter: most bugs live in the
  states nobody drew.
- **journeys** — one per Journeys-table row. Steps from clip beats (and that
  seat's clicks). `exits` / `uses` only when the expansion rules call for them.
- **criteria** — EARS per step. Skip this and the spine is a picture again.

A step with no `next` is terminal. Unlabeled `next: [J1.S4, J1.S5]` only when
the doc does not distinguish why.

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

Each feature in the spine carries the step IDs it serves. The plan cites them:

```
F2 Reconciliation view — serves J1.S3, J2.S1
```

The acceptance criteria on those steps are the feature's acceptance criteria.
They are already written; do not rewrite them from scratch in the plan.

A test that covers a step names the ID in its title: `it("J1.S3: …")`. After
features are cut, `bun run check-journeys` fails any served step with criteria
that no test or spec cites.

## Keeping it alive

Two different “wrong”:

- **Expansion** — the table is right, the Mermaid is not. Patch the YAML, re-render,
  ask which step is wrong. Same moment keeps its ID.
- **Story** — they want a different or simpler clip. Do not invent beats here.
  `/next` reopens `shape` on the journeys table; after they confirm, come back and
  re-expand. New beats get new IDs. Never reuse `J1.S2` for a new meaning.

Building teaches you the same split. A missing state on a known screen is a YAML
edit, then the code. A different payoff is a new table first.

Be honest about the failure mode: a spine nobody regenerates is a stale diagram.
The render step is cheap on purpose. If it stops being run, the spine is dead and
should be deleted rather than trusted.
