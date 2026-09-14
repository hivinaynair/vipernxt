---
name: plan
description: >-
  Turns one spine feature into a short spec and the smallest set of slices that
  can be built. Use after the journey spine exists, when the user picks a
  feature, or when next is about to build. Do not reopen the product interview.
---

# Plan one spine feature

Input: feature ID, valid spine, accepted design and ontology. Follow [execution contract](../CONTRACT.md). Output: `docs/plans/F<n>-<slug>-spec.md`, target 250 words, maximum 400.

Validate the spine; read the feature's served steps/EARS and eval-set IDs. The spec is a delta, not a duplicate Problem/Outcome/criteria document. Record only additional behavior, slice dependencies, cases covered and exclusions not already stated. If a needed step or product decision is missing, return it to `/next`; do not hide new scope in implementation notes.

Split into small coherent slices by default. The first walks one actor through useful behavior. About three steps is a sizing prompt, not an arbitrary hard cap. Each slice names served steps, eval cases and shared-surface dependencies. Wave 0 owns schema/routes/seed; feature slices do not invent missing columns or pages.

Confirm only unsettled scope/tradeoffs, not the mechanical ticket split of accepted behavior. If Linear is enabled, attach the exact spec to its issue without rewriting EARS. Do not create speculative sub-issues. Return the plan to `/next`, which invokes build; no additional go is needed.
