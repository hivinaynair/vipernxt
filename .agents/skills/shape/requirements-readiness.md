# Requirements ready for implementation

Gather enough evidence that a builder can implement the agreed behavior without choosing business policy. Use this guide during shape and reconcile it before wave 0; repeat only affected rows for a change. Readiness is scoped to the first slice or the whole MVP. Readiness of one slice never certifies the rest.

## Discover, then review

Extract settled answers from the brief, observations and existing decisions. Propose concrete models, field inventories and examples; ask one material unresolved question at a time. Work with the operator, decision/data owner and affected person as relevant. Ask about an actual recent case and failure, rather than whether a feature sounds useful.

Walk an ordinary case, an incomplete case and an important exception from input to final record and receipt. Add boundary, denial, retry and concurrency cases where the behavior exists. Include work outside the software and the fallback. Synthetic examples are labelled and cannot replace customer validation. Research establishes external constraints; the customer establishes their policy.

Create `docs/product/requirements-review.md` from [the review template](requirements-review-template.md). It indexes canonical contracts and findings; it does not duplicate their rules or own pipeline status. Each applicable row needs an exact artifact section, evidence or accepted assumption, and verification case IDs. Non-applicability needs a scope-based reason. “Later” requires removing the affected commitment from approved scope; it cannot conceal an unresolved dependency.

| Area | Minimum decisions before implementing affected scope | Canonical home |
|---|---|---|
| Outcome and scope | Person/problem, baseline and verifier, MVP boundary, exclusions, fallback, acceptance of success | Design; eval set |
| Actors and access | Roles, organization/record ownership, create/read/update/delete/export permissions, field/state restrictions, signed-out and cross-tenant denial | Access matrix; design foundations |
| Journeys | Entry/preconditions, actor action, observable result, alternative/error exit, cancellation and recovery; work handed to a person | Design beats → journey spine |
| Entities and lifecycle | Identity, attributes/types, cardinality/optionality, source of truth, invariants, states/actions, deletion/history and concurrent changes | [Ontology contract](../ontology/model-contract.md) |
| Inputs and information | Every form/filter/import/inline edit/table/detail/report, field purpose, validation/defaults, derivation, display, table operations and missing values | [Data surfaces](data-surfaces.md) |
| Business rules | Conditions, precedence, boundary examples, rounding/time/calendar rules, authorized overrides and resulting records/side effects | Ontology rule/state blocks; linked rule tables when needed |
| Integrations and background work | Owner/system of record, direction, payload/version/identity, authentication boundary, freshness, quotas, duplicate/out-of-order events, timeout/retry and recovery | `docs/product/integrations.md` when applicable |
| Files and bulk data | Formats/size/count, required evidence, ownership, processing outcomes, invalid/duplicate/partial imports, export permissions | Data surfaces; integrations |
| Usability and accessibility | Supported devices/languages/time zones, keyboard/focus/labels, understandable errors, preserved answers, accessible status and review of consequential actions | Data surfaces; design; `DESIGN.md` for presentation |
| Data handling | Sensitive fields, permitted uses/viewers, retention/deletion/history, log/analytics exposure, residency constraints and the source of any required obligation | Ontology; access matrix; `docs/product/operating-contract.md` when applicable |
| Operating limits | Expected records/concurrent users, measurable response/completion and availability targets, dependency outage behavior, backup/restore and tolerated data loss/recovery time when needed, monitoring/alerts and operating owner | Operating contract; journey criteria |
| Rollout and migration | Initial data/mapping, cutover and reconciliation, rollback/fallback, support owner, environments and required access | Operating contract; design limits |
| Model judgment | Why deterministic rules are insufficient; allowed input/output, evidence/provenance, quality cases/thresholds, abstention, human override and prohibited effects | Eval set; ontology actions; journey criteria |

Do not invent enterprise features, legal obligations or service levels to fill rows. For an applicable limit, define a measurable target, workload/environment and measurement method with the owner. “Fast”, “secure” and “handles errors” are not acceptance criteria. A local read-only prototype can explicitly exclude live imports, retention automation and production recovery; a real MVP cannot inherit those exclusions unnoticed.

## Reconcile and approve

Trace each in-scope commitment: evidence/decision → contract rule or field → design beat/spine criterion → acceptance case → planned slice. Field IDs alone do not prove coverage: cases must assert the rule and resulting state. Use [acceptance guidance](requirements-acceptance.md). Before spine expansion, use stable numbered design beats; resolve them to step IDs afterwards without changing approved meaning.

Review the linked packet with the user. An independent `spine-checker` pass checks omissions and contradictions against the evidence; it cannot approve policy for the customer. Hold material unknowns in state with an owner and done-when. A ready packet has no material unknown affecting its scope, no unaccepted domain assumptions, no contradictory contracts, and no required dependency outside its plan. Explicitly accepted assumptions remain visible with their consequences and recheck trigger.

Record approval once in `state.decisions`, naming scope and reviewed artifact revisions. Design approval can include this packet; faithful ontology/spine expansion adds no ceremonial approval. Completion of discovery does not accept working code. First-clip acceptance and authorization for the remaining factory scope still apply; reuse authorization already granted.

Before unattended handoff, pin all authoritative contracts and referenced case definitions in `specFiles`, reconcile the MVP coverage catalog and required checks, and make any technical assumptions explicit. Builders may choose internal implementation details within the contract. Missing business policy returns to `/next`; it is never silently guessed. Changes reopen affected rules, cases, consumers and pending jobs, preserving unrelated decisions.

This is a playbook review gate. Existing hooks check shape status and factory checks cover the pinned spine; they do not mechanically validate this review or prove that discovery is exhaustive. A future structural validator can check references and unresolved items, but customer walkthroughs and behavioral evidence remain necessary.
