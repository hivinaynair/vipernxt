# Specify what people enter and see before implementation

For an MVP with forms, tables or detail views, write `docs/product/data-surfaces.md` before approving implementation scope. This is the canonical field-and-display contract; link it from the design, journey steps and slice specs rather than copying it. Use stable surface/field IDs and canonical domain terms. A headless or unaffected slice records why this contract does not apply.

## Discover and iterate

Start from observed workflows, current forms/screens, sample records and the decisions users need to make. Propose a compact field/column inventory with reasons; do not make the user design every field from scratch. Walk through one ordinary record, one incomplete record and a relevant exception with the user. Use representative synthetic values only when labelled. Never copy sensitive customer records into specs.

For each item ask: who knows this, when do they know it, what decision/action needs it, and can the system derive it instead? Distinguish captured, imported, derived and displayed information. An incumbent column is evidence, not automatic scope. Record rejected fields/columns and why; avoid collecting data just because it might be useful.

Discuss one material uncertainty at a time. Show revised inventories and sample rows/form values so the user can spot omissions. Reuse shared field definitions; review only changes. Record evidence or an explicitly accepted assumption for domain rules. Technical widget choices within approved behavior need no extra approval.

## Contract format

Begin with scope (MVP or named change), revision, linked design and decision IDs. Inventory every in-scope input and information surface, including create/edit dialogs, inline edits, filters, tables and detail views. Each surface names its actor, purpose and journey step IDs; before spine expansion use design beat IDs, then resolve them to spine IDs.

### Forms and editable surfaces

| Field ID / label | Purpose / evidence | Source / type / units | Required / default / allowed values | Validation / conditions | Who sees or edits |
|---|---|---|---|---|---|

Specify date/time zone, numeric precision, length/range, uniqueness or cross-field rules where relevant; use an explicit “not applicable” only where ambiguity would otherwise remain. Define reference lookup choices, missing options, create versus edit differences and preservation of entered values after errors. Record automatic fields so workers do not turn them into unnecessary inputs.

Per form, define submission effects, success destination/receipt, loading, validation and server errors, duplicate submission, cancellation/unsaved changes and relevant concurrent-edit behavior. Say where a rule is enforced; business validation must not rely only on a browser control.

### Tables and detail views

| Column / information ID | Decision it supports / evidence | Source or calculation | Display format / missing value | Default visibility / priority | Sort / filter / search behavior |
|---|---|---|---|---|---|

Specify row identity, default ordering, row/detail navigation, actions and permissions. Decide whether selection, bulk actions, pagination, totals and export are needed; explicitly exclude them when they are not. Define empty versus no-results states, loading/error recovery, expected data volume, long values, responsive visibility and access to hidden detail. An ambiguous status, amount, date or aggregate needs a definition, not a guessed rendering.

Show a few representative rows and form examples, including the important edge case. Evaluate whether the displayed information lets the actor make the intended decision without unnecessary columns.

## Readiness and changes

Before wave 0 or feature implementation, reconcile the inventory with the approved MVP journeys, ontology and planned schema. Every surface is accounted for; each rule is sourced or an accepted assumption; material open questions are settled or the affected scope is explicitly deferred. Approval references the reviewed contract revision through a decision in state. Design approval may include this contract—do not require a separate ceremonial approval.

Planning maps slices to surface IDs and acceptance cases: required/conditional fields, invalid input, role restrictions, empty/missing data, table operations and resulting persisted state as applicable. Pin the contract and any referenced field definitions in factory `specFiles`. Workers implement it; they do not invent business fields, columns or rules. Missing decisions return to `/next`. Changes reopen the affected contract and acceptance cases; no need to re-interview unrelated surfaces.

Verification compares the exact candidate with this contract and exercises representative form/table journeys, not just visual presence. Record omissions and mismatches as failed acceptance. Automated structural checks cannot prove the business requirements are complete; user walkthrough and explicit approval remain necessary.
