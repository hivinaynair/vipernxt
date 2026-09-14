---
name: shape
description: >-
  Shapes a new SaaS before any product code: interviews one question at a time,
  researches the domain, drafts user journeys and low-fi screens, optionally
  shows a Cursor design canvas, and writes a design doc under docs/plans. Use
  when starting a new product, when the product is still uncertain, or when the
  user asks to shape the product, draft journeys, low-fi screens, a design
  canvas, or a design doc.
---

# Shape the product

Follow [the execution contract](../CONTRACT.md). Input: participant/workflow evidence, salvage, research digest and any accepted brief. Output: `docs/plans/<date>-<name>-design.md`, using [the template](design-doc-template.md), capped at two pages plus linked detail.

## Gates

1. **Orient:** read AGENTS.md, recipe and current state. Load [question bank](questions.md) only for a missing decision; never replay it from the beginning when evidence already answers it.
2. **Claim:** draft U5 from evidence—outcome, affected person, real problem, why the obvious implementation misses it, fallback. Confirm unresolved claims; create the design doc once accepted.
3. **Actors:** identify who acts, owns policy/data/money and never logs in. Default one application with explicit seats/roles; do not invent a separate app for every person. Confirm only new authority/scope choices.
4. **Journeys:** one table row per seat: bucket, wants, does, sees after first beat, sees at end. Number the clip beats. Have the user confirm the story before drawing screens; accepted brief content need not be reconfirmed.
5. **Screens:** layout bands and per-role copy for actual interactive steps. Record language/canonical language before writing copy. Include empty, loading, error and recovery states. Skip screens for a headless clip.
6. **Surfaces:** select web/agent/db and facets from the recipe, with reasons. This phase records choices; scaffolding happens after design acceptance.
7. **Review:** reconcile the doc end to end, remove contradictions/TBDs and request the unresolved design approval. Record the decision ID in state. Return to `/next`; do not add another stop or ask the user to invoke implementation.

State owns gate status and decision references; the doc owns the accepted product. Preserve progress across sessions without reconstructing approval from prose. A written brief can settle several gates at once; label assumptions individually. User research gaps remain gaps unless explicitly accepted.

## Research and decisions

When there is enough context, research the unanswered question with primary sources, then return the few findings that affect the next decision. Keep interview turns short. Research complements field observation; it does not certify the customer's actual behavior.

Treat an incumbent field/menu as evidence, not required scope. The claim determines exclusions. Distinguish customer habit from domain requirement. Record permissions, integration feasibility, error recovery and data constraints when they change the slice. Human judgment, responsibility and relationship are distinct reasons for keeping a person in a step.

## Optional visual

The design doc is sufficient. A supported host canvas may render it; read that host's documentation first. Otherwise use a disposable diagram/prototype only if it answers a material design question. Keep pre-approval exploration outside product UI paths. The visual is a view of the doc, never another authority.

## Revision

For a wrong clip/table, revise those sections and confirm the changed story; leave unaffected actors/claim alone. Return to `/next` for spine expansion. Product UI stays gated until design approval. Do not rename packages, provision vendors or write the product during shaping.
