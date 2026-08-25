# Pipeline state

`docs/product/state.yaml` is the only place the pipeline's state exists. It is
committed, because cloud agents get a fresh clone and nothing else.

```yaml
product: kubera
started: 2026-08-25
size: new-product          # new-product | new-feature | small-change

phase: 2                   # the phase in progress
phases:
  0: { name: salvage,      status: done,    artifact: docs/research/salvage.md }
  1: { name: research,     status: done,    artifact: docs/research/temple-ops.md }
  2: { name: field,        status: blocked, artifact: docs/product/homework/02-temple-visit.md }
  3: { name: shape,        status: pending }
  4: { name: journeys,     status: pending }
  5a: { name: structure,   status: pending }
  5b: { name: visual,      status: pending, optional: true }
  6: { name: build,        status: pending }

held:
  - id: H3
    kind: gather                       # gather | decide
    phase: 2
    raised: 2026-08-25
    what: Field visit to one temple using the current software
    detail: docs/product/homework/02-temple-visit.md
    done_when: All five stages in the homework file have captured values
    status: open                       # open | answered | deferred

  - id: H4
    kind: decide
    phase: 3
    raised: 2026-08-26
    what: Do priests get their own login, or does the counter clerk act for them?
    options: [own login, clerk acts for them, decide after the visit]
    recommendation: clerk acts for them
    status: answered
    answer: "clerk does it, priests wont use a computer, maybe later for the big temples"
    answered: 2026-08-27

  - id: H5
    kind: decide
    phase: 5b
    what: Pick a visual direction
    status: deferred
    until: 2026-09-15

decisions:                  # closed items, kept for the record
  - id: H1
    what: One URL with seats, or separate admin app?
    answer: "one url. seats. dont make me maintain two apps"
    date: 2026-08-25
```

## Rules

**`status` values.** `pending` → not started. `in-progress` → being worked. `blocked` →
waiting on an open `gather` item. `done` → artifact exists at `artifact:`.

**`answer` is verbatim.** Their words, spelling and all. Never a paraphrase, never
cleaned up. The paraphrase is how a decision quietly becomes a different decision.

**Deferral is not closure.** `status: deferred` plus `until:` a date. It leaves the live
list and comes back on that date.

**Ids never repeat.** `H1` means the same item forever, including after it closes.

**Nothing here is inferred from prose.** If a phase says `done`, its `artifact` exists. If
it does not, that is a contradiction to report, not to fix silently.

**`decisions:` is append-only.** It is the record of what was settled and when, so nothing
gets re-asked and no later session quietly reverses it.
