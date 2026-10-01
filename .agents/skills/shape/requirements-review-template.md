# Requirements review template

Copy into `docs/product/requirements-review.md`; delete instructions and replace placeholders. Split linked contracts by feature when necessary. State owns phase status, held items and approval decisions; this file owns the review findings and traceability.

```markdown
# <Product>: requirements review

<Ready for named scope / blocked by named finding>, based on the reviewed contracts and cases below.

Revision: <stable revision/date>. Scope: <first slice or whole MVP, exact inclusions/exclusions>.
Design: <path#section>. Evidence set: <path>. Reviewed by: <participant/role, date>.
Approval is recorded in state; do not fill an approval ID until that decision exists.

## Contract coverage

Use one row per area in the readiness guide, split rows for independently owned surfaces or integrations. “Applicable” requires completed linked content; an empty link fails review.

| Area | Applicable / excluded with reason | Contract section and revision | Evidence / decision / accepted assumption | Case IDs |
|---|---|---|---|---|
| <area> | <scope decision> | <path#section, revision> | <source or state decision ID> | <case IDs> |

## Requirement trace

Cover every in-scope rule/field/action/operating promise; group shared definitions by the IDs actually exercised. Case bodies live in the linked acceptance artifact. Before expansion use design beat IDs; afterwards resolve to spine step/criterion and catalog IDs.

| Requirement / contract IDs | Evidence or policy owner decision | Beat → step and exact criterion reference | Case IDs | Slice / existing behavior evidence |
|---|---|---|---|---|
| <stable IDs> | <source/decision> | <reference> | <IDs> | <planned slice or evidence> |

## Findings and assumptions

| Finding / assumption | Affected scope and consequence | Owner | Held / decision ID | Resolution or recheck trigger |
|---|---|---|---|---|
| <missing fact or accepted assumption> | <what cannot be implemented or what may be wrong> | <person/role> | <state ID> | <evidence/decision required> |

## Walkthrough evidence

<Date, participant/role, source provenance; ordinary/incomplete/exception case IDs; what was corrected. Label simulation explicitly.>

## Independent reconciliation

<Reviewer and date; missing inputs, impossible transitions, conflicting rules, denial/retry cases and unsupported acceptance promises found; resolution references.>

## Handoff references

<Machine packet path/hash, approved action list, pinned contract/case paths, coverage catalog, planned verification commands and deployment requirements. Record exact tested candidate later in implementation evidence, not here.>
```

The table is an index, not a replacement specification. A ready verdict is a review finding, not invented approval. Unresolved material findings keep the affected scope blocked even if a checklist has every row.
