---
name: plan
description: >-
  Turns one spine feature into a short spec and the smallest set of slices that
  can be built. Use after the journey spine exists, when the user picks a
  feature, or when next is about to build. Do not reopen the product interview.
---

# Plan one spine feature

Input: feature ID, valid spine, accepted design and ontology. Follow [CONTRACT.md](../CONTRACT.md). Output: `docs/plans/F<n>-<slug>-spec.md`, target 250 words, max 400.

Validate the spine. The spec is a delta: extra behavior, slice dependencies, cases, exclusions. Missing steps or product decisions return to `/next`. Forms/tables: link surface IDs from [data-surfaces.md](../shape/data-surfaces.md); do not paste the inventory. Unaffected slices record non-applicability.

Reconcile the scoped [requirements review](../shape/requirements-readiness.md) before wave 0. Map applicable rule/entity/field/operating IDs to acceptance cases and exact spine criteria. Include denial, boundary, retry/conflict and recovery cases where relevant; linked case definitions keep the spec short. Workers cannot settle missing business policy.

Unattended MVP handoff: reconcile every spine criterion in the [coverage catalog](../../../deploy/eve/COVERAGE.md). Foundations before consumers. Mark `first-slice` or `mvp`; only first-slice may exclude criteria with reasons. Plan integrated checks before dispatch. Run `bun run check-requirements` and pin `requirementsFile`; changed business contracts require a new hash-bound decision.

Small coherent slices. First slice walks one actor through useful behavior. Each names served steps, eval cases and shared-surface deps. Wave 0 owns schema/routes/seed.

Confirm only unsettled scope. Linear: attach the spec, do not rewrite EARS. Return to `/next` — no extra go.
