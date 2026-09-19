---
name: build
description: >-
  Implements one planned slice of a spine feature — real code, tests that cite
  journey step IDs, evidence that it works, PR to staging. Use after plan (or a
  one-slice feature with EARS already on the spine), for implementation, and for
  bug fixes against a cited step. Not for shaping or rewriting the journey.
---

# Implement one planned slice

Read [execution contract](../CONTRACT.md), AGENTS.md, the served spine criteria, spec and ontology. Output: implementation, checks, eval evidence and a reviewable branch/PR tied to the tested commit. Do not change the accepted story or expand the slice.

Read the slice’s approved data-surface contract before edits. Do not invent business fields, displayed columns, calculations or validation rules. Missing material detail returns to `/next`; ordinary technical choices within the contract remain yours.

## Isolation and dependencies

Use an isolated worktree. With a verified product remote, fetch and branch from staging, then rebase onto latest staging before final verification. For the first local clip before provisioning, use a local staging branch/worktree; do not push to an inherited kit origin. One shared-surface slice at a time; parallel feature work needs disjoint ownership. Ports and databases also need isolation.

Wave 0 owns schema, route shells, seed data and minimal layout. A missing column/page is a dependency to return to `/next`, not permission to edit shared surface from a feature worker. Integration wiring belongs to a scheduled shared-surface step. Feature folders never import each other; hoist a reusable mechanic on its second caller without moving domain policy or hidden DB access into shared utilities.

Use accepted terminology in tables, types, routes and copy. A material unresolved component choice may use `prototype`; ordinary implementation choices do not need three variants.

## Verify

For affected forms/tables, verify the approved surface IDs: fields and columns, conditional/required rules, permissions, error recovery, search/sort/filter behavior and persisted effects. Check realistic missing/long values and the representative exception; visual presence alone is insufficient.

Tests exercise actual behavior and cite journey step IDs. Run the merge bar:

```sh
bun run check-types && bun run check-boundaries && bun run check-tokens && bun run check-journeys && bun test
```

Also run the affected production build and a real critical browser path for an app slice. Use `next-dev-loop` or another available real-browser adapter. Missing required behavior evidence leaves the slice unverified. Optional capabilities may be skipped with a reason, never described as passing.

Run `bun scripts/eval.ts --require-cases`; cases live beside implementation in `*.eval.ts`. Each declared case runs or has an explicit skip reason. Report score, denominator, failures, skips and real/synthetic provenance. Domain unit checks do not prove persistence or business improvement. A low outcome score is a review finding; a broken/missing harness is not a successful check.

Final clip: `bun run check-journeys -- --complete`, combined-product browser journeys and outcome review. For bug fixes capture the failing behavior before editing. Screenshot comparisons use identical seeded data. Repeated green command exit without complete test output is not evidence.

## Integrate and return

If remote delivery is authorized, open the PR against staging; cite step IDs, eval IDs, tested commit and evidence. Use a body file/structured argument for multiline text. A reviewer push invalidates prior evidence: rerun against the current head. Integration is serial and the merged combination must be tested. Production promotion follows the configured release policy.

Return completed, needs-input or blocked with concrete evidence. Two failed repair/check rounds, recurring same-theme fixes, or an unsettled product decision return to `/next` for diagnosis; do not continue an unlimited rewrite loop. Do not call an unmerged/unverified branch a finished product.

When Cursor Cloud is selected, `/next` dispatches this contract through the factory; local sessions prepare the handoff and inspect evidence.

When launched by the factory, the attempt contract owns file scope and verification. Implement only that slice and return; Cursor may commit to its own result branch for transport; the supervisor owns acceptance, review, integration and delivery. Do not open a competing PR or independently publish.

For authenticated journeys, follow [cloud authentication](../../../docs/kit/cloud-auth.md). Pin the approved access matrix and test actor variable names in the handoff. Use Clerk development identities, verify server-side role and tenant denial, and report missing credentials as blocked rather than bypassing auth.
