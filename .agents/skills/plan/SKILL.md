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

For forms, tables or detail views, read the approved `docs/product/data-surfaces.md` using [the contract guide](../shape/data-surfaces.md). Each slice references affected surface IDs and maps their rules to acceptance cases. Missing fields, column meanings, validation or permissions are unresolved product decisions: return them to `/next` before wave 0 or implementation. Do not squeeze the field inventory into the 400-word spec; link it. Unaffected/headless slices record non-applicability.

Before the unattended MVP handoff, reconcile every criterion in the pinned journey spine against the [coverage catalog](../../../deploy/eve/COVERAGE.md), not just this feature. Identify identity, tenancy and authorization dependencies before feature slices; the first useful journey exercises the real access model. Shared foundations run before their consumers. Record every foundation as applicable with prerequisite/consumer IDs, or give a non-applicability reason. Mark the batch `first-slice` or `mvp`; only first-slice batches may exclude criteria with explicit reasons. Plan integrated journey commands and browser checks before dispatch; the final independent review rechecks every criterion, including existing behavior, on the combined candidate.

Split into small coherent slices by default. The first walks one actor through useful behavior. About three steps is a sizing prompt, not an arbitrary hard cap. Each slice names served steps, eval cases and shared-surface dependencies. Wave 0 owns schema/routes/seed; feature slices do not invent missing columns or pages.

Confirm only unsettled scope/tradeoffs, not the mechanical ticket split of accepted behavior. If Linear is enabled, attach the exact spec to its issue without rewriting EARS. Do not create speculative sub-issues. Return the plan to `/next`, which invokes build; no additional go is needed.
