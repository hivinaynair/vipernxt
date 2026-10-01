---
name: next
description: Resume discovery, requirements, first-slice review and approved MVP delivery from saved state.
---

# next

Read state, then [CONTRACT.md](../CONTRACT.md); load only the current phase. Schema: [state-schema.md](state-schema.md). Procedure: [fde-loop.md](../../../docs/playbook/fde-loop.md).

Small changes need no discovery ceremony. Accepted-product features extend the spine, then plan/build. New ideas identify the intended user and current workflow. Personal/internal projects may use the builder's documented workflow; customer validation still requires external evidence.

Without state, create it from the schema: customize/scaffold pending, setup/tickets deferred. Record participant/context and existing material; normalize supplied files with `bun scripts/salvage-inbox.mjs <inputs>` ([pile](../salvage/pile.md)). Keep product work in a dedicated clone.

Progress: salvage → research/field → shape → ontology → journeys → customize → design-system → plan/build first slice → owner review → setup/Eve. Research and field overlap. Shape may draft with gaps but cannot approve unaccepted material assumptions. Readiness must cover the first slice before wave 0 and the entire remaining MVP before handoff.

Record phase results in state and continue authorized work. After slice acceptance, record `clip.acceptance`. Story changes revise design/spine without reusing retired IDs; reopen shape only for changed claims/policy. Check drift with `bun scripts/check-drift.ts`.

For delegated work, assign one independent source or disjoint planned slice, skill, inputs, allowed paths, evidence question and output limit. Cursor uses the Grok adapters; otherwise run serially. Stop affected work for missing dependencies/policy, two failed repairs or repeated same-theme corrections.

Cloud implementation needs Cursor API access and a dedicated product repository. Validate the [hash-bound packet](../../../docs/playbook/requirements-packet.md), pin [MVP coverage](../../../deploy/eve/COVERAGE.md), then dispatch an authorized factory issue. Confirm actual workflow registration; dispatch is not completion. [Eve](../../../deploy/eve/README.md) supervises hosted batches; the local CLI is a development runner.
