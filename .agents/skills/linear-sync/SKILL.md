---
name: linear-sync
description: >-
  Publishes the features in the journey spine to Linear as issues carrying their
  journey step ids and acceptance criteria, writes the issue ids back into the
  spine, and reports drift between the two. Use after the spine is confirmed, when
  the user asks to push work to Linear, or to check Linear against the spine.
---

# linear-sync

Linear is where the **state of the work** lives — what is in progress, what shipped, what
is in this cycle. The spine is where **what the product is** lives.

## One direction

```
spine  ──publishes──►  Linear        (features become issues)
spine  ◄──ids only───  Linear        (nothing else comes back)
```

Never edit the spine because Linear changed. If they disagree, that is drift: report it
and let the user decide which is wrong.

The failure this prevents is specific. Someone files an issue directly in Linear, work
happens, and now the product has a feature that traces to no journey step and no reason.
Do that a dozen times and the spine no longer describes the product — you are back to a
list of things somebody once wanted.

## Before publishing

1. **The spine must validate.** Run the `journeys` validator first. Never publish from a
   spine with errors.
2. **The product needs its own Linear team** — one team per product, never shared. The MCP
   cannot create teams, so if it does not exist, hold a `gather` item: ask the user to
   create the team in Linear and give you its key. That is a two-minute job for them and
   impossible for you.

## The mapping

| Spine | Linear |
|---|---|
| Product | Team |
| Feature `F2` | Issue, titled `F2 · <feature title>` |
| `serves: [J1.S3, J2.S1]` | Named in the description, and as labels `J1.S3`, `J2.S1` |
| EARS criteria on those steps | The issue's acceptance criteria, verbatim |
| Walking skeleton | Milestone, or a `v1` label |
| Tasks from a plan | Sub-issues of the feature issue |
| The module it becomes | `features/<slug>/`, named in the issue |

The criteria are **already written**. Copy them; do not paraphrase them into something
looser. They were argued over during `journeys` and they are what "done" means.

Every issue description opens with a link back to the spine file and the design doc, so
whoever picks it up can find the reasoning without asking. It also names the directory the
feature becomes, so the ticket, the module and the spine entry are obviously one thing.

## Sub-issues

The feature issue is the unit of meaning. Sub-issues are the unit of work, and they come
from planning that feature — not from splitting it arbitrarily. Create them when the
feature is picked up, not in advance: a backlog of stale sub-issues is worse than none.

Order them so the first one is a thin slice that runs end to end, then hardening. The
acceptance criteria live on the parent, where they came from the spine; sub-issues inherit
them rather than restating them in looser words.

Label a sub-issue **`ui`** when it introduces a screen, a new component, or a new state.
That label is the signal to run `prototype` before writing the component — build the
variants, look at them, then implement the one that won. Without the label, UI gets
invented one screen at a time, which is the thing `design-system` exists to prevent.

## Idempotency

This runs many times. It must never create a second issue for the same feature.

1. If the spine's feature has `linear: KUB-42`, update that issue.
2. If it does not, search the team for an issue whose title starts with the feature id
   before creating anything.
3. After creating, **write the id back** into the spine YAML:

```yaml
features:
  - id: F2
    title: Reconciliation view
    serves: [J1.S3, J2.S1]
    linear: KUB-42
```

Never touch an issue's `state`, `assignee`, `cycle`, or `estimate`. Those belong to the
person doing the work — overwriting them is how a sync tool becomes something people turn
off.

## Drift

Report, do not fix:

- **Issues with no journey step** — someone added work outside the spine. Either it earns
  a journey step or it should not be built.
- **Features with no issue** — the spine has work Linear does not know about.
- **Criteria that differ** from the spine's current text.
- **Closed issues whose steps were later changed** — shipped against an older definition.

Present drift as a short list with a recommendation per item, and change nothing until the
user says which way it goes.

## What never goes to Linear

The design doc and the spine stay in the repo — not because agents cannot reach Linear
(cloud agents can, through its MCP integration), but because **a spec must be versioned
with the code it specifies**.

Check out last month's commit and the repo gives you the spine as it was when that code
was written. Linear gives you today's version of everything, always. A spec that drifts
independently of the code is a spec you cannot trust while debugging.

Linear gets status, assignment, and cycles. The repo keeps truth.
