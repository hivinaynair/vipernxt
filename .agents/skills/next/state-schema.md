# Pipeline state

`docs/product/state.yaml` is the only place the pipeline's state exists. It is
committed, because cloud agents get a fresh clone and nothing else.

```yaml
product: acme
started: 2026-09-11
size: engagement           # engagement (default) | new-feature | small-change
                           # new-product is an alias of engagement

engagement:
  site: North depot
  replacing: spreadsheet + the incumbent WMS
  outcome: "mis-picks per week"     # the U2 number
  baseline: unknown                 # fill from the eval set when known
  verifier: floor lead              # who can reject that the number moved
  fallback: incumbent WMS stays     # U5: what runs if the clip is wrong

idea: >-
  Optional claim. The confirmed reframe is the source of truth.
  Rewrite idea: to match it, or set idea_outdated: true (check-drift fails).

idea_outdated: false

reframe: >-
  Confirmed U5 paragraph: outcome, who has the pain, real problem,
  why the obvious build is wrong.

eval_set: docs/research/eval-set.md  # last 10 real cases; wave 0 seeds this

prior_art:                   # optional; miners run on create
  - path: /abs/path/to-legacy
    note: Earlier build of this product

phase: 2
phases:
  0: { name: salvage,      status: done,    artifact: docs/research/salvage.md }
  1: { name: research,     status: done,    artifact: docs/research/before-we-build.md }
  2: { name: field,        status: blocked, mode: pile, artifact: docs/product/homework/02-site-visit.md }
  3: { name: shape,        status: pending }
  4: { name: journeys,     status: pending }
  5a: { name: structure,   status: pending }
  5b: { name: visual,      status: pending, optional: true }
  6: { name: build,        status: pending }

clone:
  customized: pending
  setup: deferred              # not before they accept the clip
  tickets: deferred            # Linear after the clip

held:
  - id: H3
    kind: gather
    who: site                  # fde (default) | site
    phase: 2
    raised: 2026-09-11
    what: Photograph the incumbent screens at the depot
    detail: docs/product/homework/02-site-visit.md
    done_when: All stages in the homework file have captured values
    status: open

  - id: H4
    kind: decide
    who: fde
    phase: 3
    raised: 2026-09-11
    what: Does the picker get their own login, or does the lead act for them?
    options: [own login, lead acts for them, decide after the visit]
    recommendation: lead acts for them
    status: answered
    answer: "lead does it on the floor device, pickers wont sit at a computer"
    answered: 2026-09-12

  - id: H5
    kind: decide
    phase: 5b
    what: Pick a visual direction
    status: deferred
    until: 2026-09-25

decisions:
  - id: H1
    what: One URL with seats, or separate admin app?
    answer: "one url. seats. dont make me maintain two apps"
    date: 2026-09-11
```

## Rules

**`status` values.** `pending` → not started. `in-progress` → being worked. `blocked` →
waiting on an open `gather` item. `done` → artifact exists at `artifact:`.
A later reopen is allowed: set `journeys` back to `in-progress` when the product
story changed. Set `shape` back to `in-progress` only when the **claim** is in
doubt (that closes the UI gate). Do not invent a second spine file.

**`answer` is verbatim.** Their words, spelling and all. Never a paraphrase, never
cleaned up.

**Deferral is not closure.** `status: deferred` plus `until:` a date.

**Ids never repeat.** `H1` means the same item forever, including after it closes.

**Nothing here is inferred from prose.** If a phase says `done`, its `artifact` exists.
If it does not, that is a contradiction to report, not to fix silently.

**`decisions:` is append-only.**

**`clone.customized`.** `pending` until `/next` finishes `customize` (`PRODUCT` in
`.env.playbook`). If the flag says `done` but the package is still `vipernxt`, that
is drift — report it, do not silently flip the flag.

**`clone.setup` / `clone.tickets`.** Default `deferred` on a new engagement. The first
local clip does not wait on `setup.sh` or Linear. Flip to `pending` when they accept
the clip (or ask for a hosted preview). Missing Linear IDs are not drift while
`tickets` is `deferred`.

**`who` on held items.** `fde` (default) or `site`. The digest splits **Waiting on you**
vs **Waiting on the site**.

**`reframe`.** The confirmed U5 paragraph. Shape may not be `done` without it.
If `idea:` contradicts it, rewrite `idea:` or set `idea_outdated: true`.

**`ui_writes`.** Optional. When omitted, a Cursor hook denies writes under
`apps/*/src/app` and `apps/*/src/features` until `shape` is `done`. Set
`ui_writes: allow` to open that tree early, or `ui_writes: deny` to keep it closed
after shape. No state file = boilerplate, not gated. A **probe** (eval replay,
baseline count) is not product UI — keep it out of those trees.
