---
name: build
description: >-
  Implements one planned slice of a spine feature — real code, tests that cite
  journey step IDs, evidence that it works, PR to staging. Use after plan (or a
  one-slice feature with EARS already on the spine), for implementation, and for
  bug fixes against a cited step. Not for shaping or rewriting the journey.
---

# Implement one planned slice

Read [CONTRACT.md](../CONTRACT.md), AGENTS.md, served spine criteria, spec and ontology. Output: implementation, checks, eval evidence, and a reviewable branch/PR on the tested commit. Do not change the accepted story or expand the slice.

Read the scoped [requirements review](../shape/requirements-readiness.md) and relevant linked contracts/cases before edits. Do not invent fields, entities, rules, permissions, side effects or operating promises. Missing material detail returns to `/next`; internal technical choices within accepted behavior remain the builder's job.

## Isolation

Isolated worktree. Branch from staging (local staging before provisioning; never push to an inherited kit origin). One shared-surface slice at a time. Wave 0 owns schema, route shells, seed and layout — a missing column/page returns to `/next`. Feature folders never import each other. Use ontology terms. `prototype` only for a material unresolved component choice.

## Verify

For forms/tables, check the approved surface IDs: fields, rules, permissions, errors, search/sort/filter, persistence. Tests cite journey step IDs and exercise behavior. Run the AGENTS.md merge bar, the affected production build, and a real critical browser path (`next-dev-loop` or equivalent). Missing required evidence leaves the slice unverified.

Exercise the linked acceptance cases and resulting state/side effects, including applicable denial, boundary, duplicate, conflict and dependency-failure outcomes. A citation, screenshot or checklist alone does not prove a rule. Operating targets must be measured under the approved workload/environment.

`bun scripts/eval.ts --require-cases` — cases in `*.eval.ts`. Report score, denominator, failures, skips, provenance. A low score is a review finding; a broken harness is not a pass. Final clip: `bun run check-journeys -- --complete` plus combined-product browser journeys. Bug fixes: capture the failing behavior first. Green exit without complete output is not evidence.

## Return

Authorized remote delivery: PR against staging; cite step IDs, eval IDs, tested commit and evidence. A reviewer push invalidates prior evidence. Two failed repair rounds, same-theme fixes, or an unsettled product decision return to `/next`. An unmerged branch is not a finished product.

Factory attempts own file scope and verification: implement that slice and return. Do not open a competing PR. Authenticated journeys: [cloud-auth.md](../../../docs/kit/cloud-auth.md).
