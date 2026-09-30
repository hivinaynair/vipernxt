# Domain model contract

Model the agreed domain before wave 0 chooses storage. Draft alongside shape to expose policy questions before design approval; finalize faithful terminology after approval without re-asking settled decisions. Include only entities needed by the approved scope. Canonical definitions live in `docs/product/ontology.md`; UI field definitions link here rather than defining a competing model.

## Entities and attributes

| Entity ID / canonical term | Meaning and identity | Owner / source of truth | Evidence / decision |
|---|---|---|---|

For each entity specify identity lifetime, business identifier versus internal key, uniqueness scope and duplicate/merge policy where creation/import is in scope. Identify organization/tenant ownership and who may act; a person, role and membership are not interchangeable entities.

| Attribute ID | Meaning / source | Domain type, units, precision | Required / unknown / default | Constraints / derivation | Sensitivity / lifecycle |
|---|---|---|---|---|---|

Define reference/enumeration choices, length/range, money currency and rounding, local dates versus instants/time zones, missing/unknown/empty semantics and cross-field invariants where applicable. A missing UI input does not imply a missing stored attribute: IDs, ownership, calculated values and timestamps may be supplied automatically. State where derived values come from and when they become stale. Every attribute has observed/rule/assumption provenance, linked once if shared.

## Relationships and invariants

| Relationship | From → to | Cardinality and optionality at each end | Ownership / invariant | Removal behavior |
|---|---|---|---|---|

Describe many-to-many facts when they have their own attributes/history. State whether an orphan is valid, whether ownership may change, and whether reference deletion restricts, unlinks or removes dependent records. Lifecycle rules specify archive/delete/restore when available, audit/history, retention and correction of imported data. Exclude unsupported actions explicitly. Do not guess a cascading delete or turn every domain noun into a table.

## Actions, states and rules

| Action ID | Actor and preconditions / current state | Input or rule IDs | Allowed next state | Atomic effects / receipt | Denial / retry / conflict / recovery |
|---|---|---|---|---|---|

List states with their meaning; permitted transitions and forbidden transitions are distinct from display labels. Include cancellation, rejection, reopening and terminal behavior only where the workflow needs them. Define who may override a rule, required reason/history and which downstream effects must be reversed. Link permissions to the access matrix; enforce them at the trusted service layer.

Complex decisions use a linked decision table with conditions, precedence, outcome, source/owner and boundary examples. Avoid arbitrary status strings, default values or tax/eligibility rules chosen by the builder. Include transaction boundaries and the domain outcome of duplicate actions, stale versions and partially failed side effects where these operations exist; technical locking/idempotency mechanisms are later implementation choices.

## Reconcile

Walk ordinary/incomplete/exception records through actions. Ensure form optionality matches entity constraints, every relationship can be populated from available information, each displayed aggregate/status has a definition, and every planned write has an authorized action. Keep vocabulary decisions, rejected synonyms and material open questions visible. Model-to-schema mapping is wave 0 work against this approved contract; missing domain policy returns to `/next`.
