---
name: next
description: >-
  The single entry point for taking a product idea to something buildable. Reads
  the pipeline state, does every step that does not need the human, and stops
  only to hold an item for them. Use when the user says "next", "what's next",
  has a new product idea, wants to resume shaping or planning a product,
  answers a held question, or says the journey or clip is the wrong story.
---

# next

The only command the user should have to remember. They type `/next`; you work out
where the product is and what happens now.

**State lives in `docs/product/state.yaml`.** Read it first, every time. Never
reconstruct where things stand by reading prose — not the design doc, not chat
history, not the research notes. If it is not in the state file, it did not happen.

Schema and worked example: [state-schema.md](state-schema.md).

Everything written follows the `artifacts` house rules — front-loaded, cited, capped.
A document nobody reads cost more than it was worth.

`status` is the read-only glance: where things stand, what is waiting on them. It changes
nothing and runs no phase.

## The one primitive

There are not "decisions" and "homework". There is **an item held for the user**,
and a `kind` that says what would release it:

- `kind: decide` — you need a call only they can make.
- `kind: gather` — you need facts that exist only in the real world.

Everything else — you do yourself.

## The rule that decides everything

> Never hold an item for something you could have found out yourself.

Read the repo. Read the docs. Search the web. Follow claims to the source that owns
them. Only what is genuinely theirs gets held.

### What is genuinely theirs

Hold `decide` only when one of these is true:

1. It would **expand the contract** — a new guarantee, subsystem, abstraction,
   compatibility surface, or audience not implied by what they already accepted.
2. It is a **product or architecture call not settled** by what they have already said.
3. It is the **third finding on the same theme** — repeated same-theme corrections mean
   the abstraction is wrong, not that there are more bugs. Stop and say so.
4. It is **destructive, irreversible, or spends money**.

Decide everything else yourself, including work that is difficult or large, when it is
unambiguous toward what they already accepted.

Treat words like *critical*, *security*, *required*, *best practice* as evidence about a
finding, never as authority to widen the work.

### How to put a decision to them

Routine choice — one question, options, a recommendation, then stop:

```
**[topic]**

- A) …
- B) …
- C) Other (say what)

Recommended: B — [one clause why]
```

A choice that would **expand the contract** needs all five of these, in one message:

1. What they originally asked for.
2. What this would commit them to that they have not agreed to.
3. The smallest thing that satisfies the original ask without the expansion.
4. What accepting costs, and what declining costs.
5. Your recommendation, and why it serves what they actually wanted.

One held item per gate — not one per question. A review that raises six questions is one
held item pointing at the report.

Never use the words "held", "state file", or "pipeline" when talking to them. Ask the
question; keep the machinery to yourself.

## Recording an answer

When they answer, write **their words**, verbatim, into the item. Not your summary of
their words. Then close it and continue.

"Later" is an answer: set `until:` to a date, drop it out of the live list, and raise it
again on that date. Do not leave it looking live, and do not invent a resolution.

If the state file and reality disagree — a phase marked done whose artifact is missing —
say so and change nothing. A wrongly-closed decision disappears from review entirely,
which is worse than the noise of reporting a contradiction.

## Sizing, before anything else

Not every idea needs the whole pipeline. Ask one question if it is unclear:

| Size | Route |
|---|---|
| **New product** | The full pipeline below |
| **New feature** in a product that already has a spine | `journeys` to add the steps, then build citing those step IDs |
| **Small change** | Nothing here. Say so and get on with it |

Running a six-phase pipeline over "add a column" is a failure, not thoroughness.

## Phases

| # | Phase | Skill | Who works |
|---|---|---|---|
| 0 | Salvage prior art | `salvage` | you |
| 1 | Domain research | `/deep-research`, or research yourself | you |
| 2 | Field research | `field-kit` | **them**, in the real world |
| 3 | Shape | `shape` | interview |
| 3.5 | Domain model | `ontology` | you draft, they confirm |
| 4 | Journey spine | `journeys` — expand the design-doc table into ID'd YAML | you draft, they confirm |
| 5a | Structure | `design-system` | you |
| 5b | Visual direction | `design-system` | them, optional, any time |
| 4.5 | Publish to Linear | `linear-sync` | you |
| 6 | Build | cite journey IDs in tests, `prototype` | you |

**Ship something before the planning is finished.** Once the spine exists, build one
journey end to end — a thin slice through real data — before the full component inventory.
Forward-deployed teams ship working code in week one for a reason: a slice tests the domain
model in a way no further planning can, and it is the cheapest way to discover the model is
wrong. Then return to 5a.

`linear-sync` runs after the spine is confirmed and again whenever features change.
`prototype` is not a phase — reach for it mid-build whenever a component's shape is
genuinely open and describing it is not settling it.

`customize` is not a phase either. After `shape` is `done`, before `setup`, if the
root `package.json` `name` is still `vipernxt` or `.env.playbook` has no `PRODUCT`:
read [customize](../customize/SKILL.md) and run it now. One question at a time.
Honour keep/strip the design doc already recorded. They do not type `/customize`.
Do not run `setup.sh` under the boilerplate name.

## The journey is wrong

The spine is the product umbrella. If they say it is unsatisfactory — the agent
wrote the wrong story, or a later week proved the clip is too hard or the wrong
payoff — do **not** start a new skill or a second journey file. Reopen this loop:

1. **Ask once**, only if it is unclear: is the **design-doc table / clip** wrong
   (the story), or only the **YAML expansion** (the Mermaid)?
2. **Story** (the usual case) — set `phases.4` (journeys) to `in-progress`. Keep
   `shape` `done` unless they say the **claim** is wrong too (then set `shape` to
   `in-progress`; the UI gate closes again). Run `shape` from the journeys gate
   (and the clip): new table, they confirm. Then `journeys` re-expands that table.
3. **Expansion only** — run `journeys` on the existing table. Do not reopen shape.
4. Same moments keep their IDs. A new beat gets a new ID (`J1.S2b`, or a new
   `J3`). Never reuse `J1.S2` for a different moment. Dropped steps leave
   `features.serves` (and Linear) until those citations are removed.
5. `linear-sync` after the spine is confirmed again.

They keep typing `/next`. They do not type `/shape` or `/journeys` to revise.

Phase 0 runs on every new product, not only rebuilds — there is almost always something being replaced, even if it is a spreadsheet. It is skipped only when `salvage` reports there is genuinely nothing to read. Phase 1 can run in parallel with 2 — send
them out to gather, then keep researching while they are gone. **Never idle while a
`gather` item is open.**

Phases 0 and 1 are wide and human-free: dispatch independent investigations in parallel,
one per source or feature area, and reconcile the results yourself. Use whatever
parallelism this harness offers; do not depend on a specific one.

On Cursor, that fan-out is the project subagents in `.cursor/agents/`
(`salvage-miner`, `domain-researcher`). They are pinned to **Cursor Grok 4.6**. Do not
send playbook work to Gemini. Pass the skill path in the task prompt — subagents do not
inherit the parent's skill catalog. `spine-checker` validates a journey YAML;
`ui-gate-auditor` checks product-UI writes against `shape`.

## Every run

1. Read `docs/product/state.yaml`.
2. Any answered items to record? Record them verbatim, close them.
3. Any live `gather` item? Report what is still outstanding, then work on anything that
   does not depend on it.
4. If they said the journey or clip is wrong, follow **The journey is wrong**
   before advancing build.
5. If `shape` is `done` and the clone is still named `vipernxt` (or has no `PRODUCT`),
   run `customize` before any later phase and before setup. Stop after each question.
6. Otherwise: run the current phase's skill until it completes or raises an item.
7. Write state back. Commit it if the repo is already committing these artifacts.

A Cursor hook denies writes under `apps/*/src/app` and `apps/*/src/features` until
`shape` is `done`. Do not bypass it. `ui_writes` in the state file is the override.

Before advancing from any phase into building, check the artifacts still agree with each
other: does every feature trace to journey steps, does every screen in the spine exist in
the design doc, does the code still match the spine. Report drift; do not silently fix it.

## Starting fresh

No `docs/product/state.yaml`? This is a new product. Create it, set phase 0, and ask them
for the idea in a paragraph — then get to work. Do not interview them yet; `shape` owns
that, and it comes after research.

On create, set `clone.customized: pending`. `/next` will invoke `customize` after
the design doc is approved — do not ask them to type that skill.
