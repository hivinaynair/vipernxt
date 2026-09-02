---
name: plan
description: >-
  Turns one spine feature into a short spec and the smallest set of slices that
  can be built. Use after the journey spine exists, when the user picks a
  feature, or when next is about to build. Do not reopen the product interview.
---

# plan

One feature from the spine becomes a spec, then slices. The spine already has
the acceptance criteria. This skill does not rewrite them and does not invent a
product story.

`/next` invokes this. They may also ask to plan a feature by id (`F2`).

## Host

This skill does not care which product, model, or machine is running. Do not
refuse because the session is local, remote, or a different vendor. Do not tell
them to switch hosts. Do the work here, or stop on a real blocker (a product
decision the spine does not settle).

## Before you write

1. The spine validates: `bun scripts/journey.ts validate docs/journeys/<name>.yaml`.
2. Read the feature's `serves` steps and their EARS lines. Those lines **are**
   the acceptance criteria.
3. If a step the feature needs is missing, or the clip is the wrong story, stop.
   `/next` reopens `shape` / `journeys`. Do not paper over it in the spec.
4. Read `AGENTS.md` and the design doc the spine points at. Inspect code only to
   fill a gap (does this screen exist yet?).

## Spec

A **delta** on the spine, not a replacement. Target 250 words, never more than
400. Do not restate Problem / Outcome / the EARS lines.

Write `docs/plans/<feature-id>-<slug>-spec.md` (e.g. `F2-reconciliation-spec.md`).
If the feature has `linear:`, also put the same spec on that issue as a comment
and do not paraphrase the criteria.

```markdown
# F2 · Reconciliation view

Spine: docs/journeys/<name>.yaml — serves J1.S3, J2.S1
Criteria: the EARS on those steps (not restated).

## Behavior
- Only contracts the spine did not already say.

## Slices
1. **F2.1** — thin slice: one actor, those steps, real data, one test per
   cited step (`it("J1.S3: …")`).
2. **F2.2** — hardening only if F2.1 cannot carry it.

## Out of scope
- Only exclusions not already in the design doc.
```

One slice when the feature is one dependency-free path. Several slices only when
order matters or one agent context cannot hold the whole thing. First slice is
always the walking skeleton through the served steps.

Show a multi-slice list and wait for one confirmation. A single slice: write it
and continue.

## Do not

- Dump tickets, file paths, or implementation walkthroughs.
- Create a backlog of sub-issues “in case”. Sub-issues happen when `build`
  picks up a slice — see `linear-sync`.
- Name a host or a model as the place this must run.
- Vendor a second story of the product. If Linear and the spec disagree, the
  spine wins.

When the spec is written, `/next` runs `build` on the first slice (isolate →
implement → prove → ship) unless they stop you.
