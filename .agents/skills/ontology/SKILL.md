---
name: ontology
description: >-
  Models the domain as entities, properties, links and actions in the domain's own
  vocabulary, before any schema or journey work. Use after the claim is confirmed
  and before the journey spine, when the data model is unclear, or when the same
  thing is being called three different names.
---

# Domain model

Input: accepted claim and workflow evidence. Output: `docs/product/ontology.md`, before spine/schema work. Follow [execution contract](../CONTRACT.md) and artifact caps.

Define entities in the participants' vocabulary, then properties, links/cardinality, actions/authorized actors, states and allowed transitions. An ontology describes the domain; tables are later storage choices.

Every entity/field needs provenance. Printed forms, incumbent data, field observations and authoritative rules are evidence with different strength. A printed field is not automatically necessary or legally required. Mark fields observed-used, required-by-rule, historical, assumed or unknown. Resolve overloads and rejected synonyms; canonical terms then apply to journeys, code, seed and UI.

Output an entity table with definitions/sources; blocks for entities with real state transitions; vocabulary decisions; open questions. Justify or remove invented entities. Confirm only ambiguity or domain choices not already settled by the accepted design. Return to `/next` without repeating the whole interview.
