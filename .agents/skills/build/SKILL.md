---
name: build
description: >-
  Implements one planned slice of a spine feature — real code, tests that cite
  journey step IDs, PR to staging. Use after plan (or a one-slice feature with
  EARS already on the spine), for implementation, and for bug fixes against a
  cited step. Not for shaping or rewriting the journey.
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

## Do

1. Branch from `staging` (or the repo's integration branch). One branch per
   slice or per planned delivery group — not per file.
2. Implement only this slice. Features live in `apps/*/src/features/<slug>/`.
   Do not import another feature.
3. Tests name the step: `it("J1.S3: …")`. After features are cut,
   `bun run check-journeys` must pass.
4. Merge bar before you offer a PR:

   ```sh
   bun run check-types && bun run check-boundaries && bun run check-tokens && bun run check-journeys && bun test
   ```

5. If this host can exercise the UI, do it (`next-dev-loop` or the equivalent).
   If it cannot, say so. Do not fake a screenshot.
6. Open a draft PR onto `staging`. Say which step IDs landed. Do not merge to
   `main`.

## Stop and return

| Stop | Hand back to |
|---|---|
| The clip or table is the wrong story | `/next` → `shape` / `journeys` |
| A product decision the spine did not settle | `/next` (do not invent it) |
| The component's look is still open | `prototype`, then continue |
| Checks fail | Fix here. Do not declare done |

## Do not

- Implement two features “while you are in there”.
- Rewrite EARS into looser ticket language.
- Leave a `/prototypes/` route after they picked a variant.
- Name Cursor Cloud, Claude, or any other host as a requirement or a reason to
  refuse.

When the slice is in a draft PR, `/next` either takes the next slice or waits
for them.
