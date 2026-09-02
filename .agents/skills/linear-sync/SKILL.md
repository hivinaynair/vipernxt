---
name: linear-sync
description: >-
  Publishes the features in the journey spine to Linear as issues carrying their
  journey step ids and acceptance criteria, writes the issue ids back into the
  spine, and reports drift between the two. Use after the spine is confirmed, when
  the user asks to push work to Linear, or to check Linear against the spine.
---

# linear-sync

Linear holds the **state of the work**. The spine holds **what the product is**.

```
spine  ──publishes──►  Linear      (features become issues)
spine  ◄──ids only───  Linear      (nothing else comes back)
```

Never edit the spine because Linear changed. If they disagree that is drift:
report it and let the user decide which is wrong.

The failure this prevents is specific. Someone files an issue straight into
Linear, work happens, and the product grows a feature that traces to no journey
step and no reason. A dozen of those and the spine no longer describes the
product.

## How to run it

```sh
bun scripts/journey.ts validate docs/journeys/<name>.yaml   # never publish from an invalid spine
bun scripts/linear-sync.ts plan  docs/journeys/<name>.yaml
```

The plan says, per feature, whether it is a create or an update and gives the
exact title, labels and body. **Use it verbatim.** Issue bodies are generated,
so re-running produces no diff unless the spine actually changed — that is what
makes this safe to run many times.

Execute the plan through Linear's MCP, then record each new id:

```sh
bun scripts/linear-sync.ts record docs/journeys/<name>.yaml F2 KUB-42
```

Record it immediately, one at a time. An unrecorded id is a duplicate issue on
the next run.

**Before creating anything, search the team for an issue whose title starts with
that feature id.** The script cannot see Linear, so this is the only thing
standing between an interrupted run and a second `F2 · Reconciliation view`. If
you find one, record its id instead of creating.

No API key: the MCP is already authenticated and reaches Linear from local and
cloud sessions alike. A second credential buys nothing until something without
an MCP — CI — needs to do this.

## Policy the script cannot enforce

**One team per product**, never shared. The MCP cannot create teams, so if it
does not exist, hold a `gather` item: ask for the team and its key. Two minutes
for them, impossible for you.

**Never touch** an issue's `state`, `assignee`, `cycle` or `estimate`. Those
belong to whoever is doing the work. Overwriting them is how a sync tool becomes
something people turn off.

**Sub-issues come from `plan`**, not from splitting a feature arbitrarily, and
they are created when the feature is picked up — a backlog of stale sub-issues
is worse than none. Criteria live on the parent; sub-issues inherit them rather
than restating them in looser words. Label a sub-issue **`ui`** when it
introduces a screen, component or state — that label is the signal to run
`prototype` first.

## Drift

`bun scripts/check-drift.ts` reports what it can see from the repo: a feature
with no issue, a feature serving a step that no longer exists.

Three kinds it **cannot** see, because the script never reads Linear. Check
these through the MCP when they ask for a drift report:

- an issue with no journey step — someone added work outside the spine; either
  it earns a step or it should not be built
- an issue whose criteria no longer match the spine's current text
- a closed issue whose steps changed after it shipped

Present drift as a short list with a recommendation each, and change nothing
until they say which way it goes.

## What never goes to Linear

The design doc and the spine stay in the repo — not because agents cannot reach
Linear, but because **a spec must be versioned with the code it specifies**.
Check out last month's commit and the repo gives you the spine as it was when
that code was written; Linear only ever gives you today.

Linear gets status, assignment and cycles. The repo keeps truth.
