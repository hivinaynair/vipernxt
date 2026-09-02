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
steps and the spec `plan` wrote — or, on the fast path, the EARS on those steps
alone.

`/next` invokes this. They may also name a feature id or a slice (`F2.1`).

## Host

This skill does not care which product, model, or machine is running. Do not
refuse because the session is local, remote, or a different vendor. Do not tell
them to switch hosts. Do the work here.

If a handy tool is missing (browser, preview URL, a vendor CLI), skip it and
say what you could not verify. The merge bar is the gate, not a particular
cloud.

## Before the first edit

1. `shape` is `done` (or `ui_writes: allow`). Do not bypass the UI gate.
2. Read the spec if it exists (`docs/plans/F<n>-*-spec.md`). If there is no spec
   and the feature is one obvious slice, that is the fast path — build from the
   spine EARS. If the story is loose, stop; `/next` reopens `journeys`.
3. Read `AGENTS.md`, the served steps, and the code you will touch.
4. Read `docs/product/ontology.md`. Its canonical terms are the only names
   allowed — tables, columns, types, components, routes, UI copy. A rejected
   synonym in the code is a defect, not a style preference.
5. A `ui` slice or a new screen / component / state: run `prototype` first when
   the shape is still open. Do not invent the layout in production.

## Isolate

One slice, one branch, one agent. Up to five agents run at once.

1. `git fetch origin`.
2. **Scope check.** `gh pr list`, and `gh pr diff <n> --name-only` on anything
   open. If another slice is already editing the files you need, stop and say
   so. Do not race it.
3. Branch from `staging` — the integration branch, never `main`. One branch per
   slice, not per file.
4. **Rebase onto latest `staging` before the merge bar**, not only at branch
   time. Five parallel agents means your base went stale while you worked.
5. A production hotfix is the one exception: branch from `main`, land on `main`,
   back-merge to `staging` the same day or the branches drift apart.

Worktrees isolate files. They do not isolate ports, the database, or the
lockfile. Confirm a dev server is *your* process before trusting what it serves,
and regenerate a conflicted lockfile rather than hand-merging it.

**Parallel safety.** Two agents in different `apps/*/src/features/<slug>/`
folders cannot collide — features may not import each other. Everything else is
shared surface: `src/app`, `src/shared`, `packages/*`, the schema, any
`package.json`. A slice touching shared surface runs **alone**, with no sibling
agents in flight.

Schema is not your job. Tables land in wave 0, before any feature slice starts.
If your slice needs a column that does not exist, stop and hand back to `/next`.

## Do

1. Implement only this slice. Features live in `apps/*/src/features/<slug>/`.
   Do not import another feature.
2. Tests name the step: `it("J1.S3: …")`. After features are cut,
   `bun run check-journeys` must pass.
3. Merge bar before you offer a PR:

   ```sh
   bun run check-types && bun run check-boundaries && bun run check-tokens && bun run check-journeys && bun test
   ```

## Hoisting

Feature folders are the vertical boundary and a script enforces them. Layering
*inside* a feature is yours to judge, and there is one rule:

> **A `check-boundaries` failure is the signal to hoist — never a reason to
> weaken the rule.**

Its own trigger is the second caller. The first lives inside a feature; when the
second appears in a different one, that mechanic has earned promotion — to
`src/shared` (app-local) or a package (cross-app). Extract the operational
"how"; leave the domain "why/when" in the feature that owns it.

| Do | Don't |
|---|---|
| Extract when a second caller appears | Extract for one caller |
| Explicit parameters, structured returns | Hidden global state |
| Return data to the caller | Reach into `@repo/db` from a hoisted module |
| One capability per function | One function that does everything |

## Prove

Evidence, not prose. "It works" is not a claim you get to make unbacked.

| Have | Capture |
|---|---|
| Always | merge-bar output, and a test per cited step |
| Playwright | traces and screenshots — `trace: "on"`, `screenshot: "on"` |
| A running app | walk the steps (`next-dev-loop` or the equivalent) |
| A preview URL | `before-and-after` on the changed screen |
| Nothing visual | measured numbers, output pairs, the transcript excerpt |

Fixing a bug: **capture the "before" while reproducing it, before you fix it.**
It is cheap then and impossible afterwards.

`before-and-after` drives `agent-browser`, which only takes a URL, so an
authenticated screen is reached through `/api/preview-login`. Seeded data must
be identical on both sides or every pair reads as a change. Never upload a
capture of real data to a public host — see that skill's house rules.

State what you could not verify. Do not fake a screenshot.

## Ship

1. Draft PR onto `staging`. Never onto `main`.
2. The body says which **step IDs** landed and links the evidence. A PR that
   cannot name a step ID is building something the spine does not describe —
   stop and hand back to `/next`.
3. The bug board reviews and may push fixes to your branch. Auto-merge must
   require green **after the last push**, or you merge a state nothing checked.
4. Regenerate evidence if the board pushed. Otherwise your screenshots describe a
   build that no longer exists.

## Stop and return

| Stop | Hand back to |
|---|---|
| The clip or table is the wrong story | `/next` → `shape` / `journeys` |
| A product decision the spine did not settle | `/next` (do not invent it) |
| A column or table your slice needs is missing | `/next` (schema is wave 0) |
| The component's look is still open | `prototype`, then continue |
| Merge bar fails twice | `/next`. Stop editing |
| Third fix on the same theme | `/next`. The abstraction is wrong, not the code |
| Checks fail | Fix here. Do not declare done |

## Do not

- Implement two features "while you are in there".
- Rewrite EARS into looser ticket language.
- Rename a domain term because the code reads better that way.
- Leave a `/prototypes/` route after they picked a variant.
- Merge to `main`, or open a PR against it.
- Name Cursor Cloud, Claude, or any other host as a requirement or a reason to
  refuse.

When the slice is in a draft PR, `/next` either takes the next slice or waits
for them.
