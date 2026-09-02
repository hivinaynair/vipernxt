---
name: build
description: >-
  Implements one planned slice of a spine feature — isolate, code, evidence,
  draft PR to staging. Tests cite journey step IDs. Use after plan (or a
  one-slice feature with EARS already on the spine), for implementation, and
  for bug fixes against a cited step. Not for shaping or rewriting the journey.
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
4. A `ui` slice or a new screen / component / state: run `prototype` first when
   the shape is still open. Do not invent the layout in production.

## Factory

Four beats, in order. Source mapping:
[michaelshimeles/skills](https://github.com/michaelshimeles/skills)
(isolate → build → prove → ship). Adapted to Bun, `staging`, and feature
folders. They type `/next`; they do not type `/isolate` or `/greploop`.

### 1. Isolate — [isolate](../isolate/SKILL.md)

Own branch. Worktree only when the harness did not already give you one.
From `origin/staging`, never `main`. Scope-check open PRs; stop on overlap.

### 2. Implement — this skill + [code-structure](../code-structure/SKILL.md)

1. Implement only this slice. Features live in `apps/*/src/features/<slug>/`.
   Do not import another feature.
2. Orchestration (why/when) stays in the feature. Repeated mechanics (how)
   hoist to `shared/` or a package when a second caller appears — not a
   parallel `services/` tree.
3. Tests name the step: `it("J1.S3: …")`. After features are cut,
   `bun run check-journeys` must pass.

### 3. Prove — [evidence](../evidence/SKILL.md) + [next-dev-loop](../next-dev-loop/SKILL.md)

Merge bar before you offer a PR:

```sh
bun run check-types && bun run check-boundaries && bun run check-tokens && bun run check-journeys && bun test
```

Then prove the served steps at runtime. `next-dev-loop` when `next dev` is
up. `evidence` keeps the artifacts (screenshots, recording, Playwright
captures, or measured numbers) and a before/after pair when the surface is
visible. If this host cannot exercise the UI, say so. Do not fake a
screenshot.

### 4. Ship

Open a draft PR onto `staging`. Say which step IDs landed. Put the evidence
in the body. Do not merge to `main`.

If Greptile (or they named it) is on the repo, run
[review-loop](../review-loop/SKILL.md). If it is not, skip — one line, not a
setup task.

## Stop and return

| Stop | Hand back to |
|---|---|
| The clip or table is the wrong story | `/next` → `shape` / `journeys` |
| A product decision the spine did not settle | `/next` (do not invent it) |
| The component's look is still open | `prototype`, then continue |
| Checks fail | Fix here. Do not declare done |
| Open PR overlaps this slice's files | `isolate` — stop; that is their call |

## Do not

- Implement two features “while you are in there”.
- Rewrite EARS into looser ticket language.
- Leave a `/prototypes/` route after they picked a variant.
- Name Cursor Cloud, Claude, or any other host as a requirement or a reason to
  refuse.

When the slice is in a draft PR, `/next` either takes the next slice or waits
for them.
