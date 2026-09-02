---
name: build
description: >-
  Implements one planned slice of a spine feature — real code, tests that cite
  journey step IDs, evidence that it works, PR to staging. Use after plan (or a
  one-slice feature with EARS already on the spine), for implementation, and for
  bug fixes against a cited step. Not for shaping or rewriting the journey.
---

# build

Implement **one** slice. Do not widen it. The contract is the feature's served
steps and the spec `plan` wrote — or, on the fast path, the EARS on those steps.

`/next` invokes this. They may also name a feature id or a slice (`F2.1`).

## Host

Does not matter which product, model or machine is running. Never refuse because
the session is local, remote or a different vendor, and never tell them to
switch hosts. If a tool is missing (browser, preview URL, a vendor CLI), skip it
and say what you could not verify. The merge bar is the gate, not a cloud.

## Before the first edit

1. `shape` is `done` (or `ui_writes: allow`). Do not bypass the UI gate.
2. Read the spec (`docs/plans/F<n>-*-spec.md`) if it exists. No spec and one
   obvious slice is the fast path — build from the spine EARS. If the story is
   loose, stop; `/next` reopens `journeys`.
3. Read `AGENTS.md`, the served steps, and the code you will touch.
4. Read `docs/product/ontology.md`. Its canonical terms are the **only** names
   allowed — tables, types, components, routes, UI copy. A rejected synonym in
   the code is a defect, not a style preference.
5. New screen, component or state with its shape still open: run `prototype`
   first. Do not invent the layout in production.

## Isolate

One slice, one branch, one agent; up to five at once.

1. `git fetch origin`, then **scope check**: `gh pr list` and `gh pr diff <n>
   --name-only`. If another slice is editing the files you need, stop and say
   so. Do not race it.
2. Branch from `staging` — never `main`. One branch per slice, not per file.
3. **Rebase onto latest `staging` before the merge bar**, not just at branch
   time. Five parallel agents means your base went stale while you worked.

`AGENTS.md` has the parallel rules: a slice touching shared surface runs alone.
Schema is not your job — tables land in wave 0. If your slice needs a column
that does not exist, stop and hand back.

Worktrees isolate files, not ports, databases or lockfiles. Confirm a dev server
is *your* process; regenerate a conflicted lockfile rather than hand-merging.

## Do

1. Implement only this slice, in `apps/*/src/features/<slug>/`. Do not import
   another feature.
2. Tests name the step: `it("J1.S3: …")`.
3. Merge bar before you offer a PR:

   ```sh
   bun run check-types && bun run check-boundaries && bun run check-tokens && bun run check-journeys && bun test
   ```

## Hoisting

Feature folders are the vertical boundary and a script enforces them. Layering
inside a feature is your judgement, with one rule:

> **A `check-boundaries` failure is the signal to hoist — never a reason to
> weaken the rule.**

The trigger is the second caller. The first lives inside a feature; when the
second appears in a different one, that mechanic has earned promotion to
`src/shared` (app-local) or a package. Extract the operational "how"; leave the
domain "why/when" where it belongs.

| Do | Don't |
|---|---|
| Extract when a second caller appears | Extract for one caller |
| Explicit parameters, structured returns | Hidden global state |
| Return data to the caller | Reach into `@repo/db` from a hoisted module |

## Prove

Evidence, not prose. "It works" is not a claim you make unbacked.

| Have | Capture |
|---|---|
| Always | merge-bar output, a test per cited step |
| Playwright | traces and screenshots |
| A running app | walk the steps (`next-dev-loop` or equivalent) |
| A preview URL | `before-and-after` on the changed screen |
| Nothing visual | measured numbers, output pairs |

Fixing a bug: **capture the "before" while reproducing it, before you fix it.**
Cheap then, impossible afterwards.

`before-and-after` reaches authenticated screens through `/api/preview-login`,
and both sides need identical seeded data or every pair reads as a change. State
what you could not verify. Do not fake a screenshot.

## Ship

Draft PR onto `staging`, never `main`. The body names the **step IDs** that
landed and links the evidence — a PR that cannot name a step is building
something the spine does not describe, so stop and hand back.

The bug board may push fixes to your branch. Auto-merge must require green
**after the last push**, and evidence regenerates if the board pushed —
otherwise your screenshots describe a build that no longer exists.

## Stop and return

| Stop | Hand back to |
|---|---|
| The clip or table is the wrong story | `/next` → `shape` / `journeys` |
| A product decision the spine did not settle | `/next` (do not invent it) |
| A column your slice needs is missing | `/next` (schema is wave 0) |
| The component's look is still open | `prototype`, then continue |
| Merge bar fails twice | `/next`. Stop editing |
| Third fix on the same theme | `/next`. The abstraction is wrong |
| Checks fail | Fix here. Do not declare done |

## Do not

- Implement two features "while you are in there".
- Rewrite EARS into looser ticket language, or rename a domain term.
- Leave a `/prototypes/` route after they picked a variant.
- Merge to `main`, or open a PR against it.
- Name a host as a requirement or a reason to refuse.
