---
name: field-kit
description: >-
  Writes the field-research homework — who to talk to, what to ask, what to
  observe, what to collect — then turns what comes back into cited findings. Use
  when the product serves people the user is not, before shaping something in an
  unfamiliar domain, or when the user returns from talking to real users.
---

# Field research

Input: salvage/research gaps. Output: targeted homework or findings plus a cited eval set. Follow [execution contract](../CONTRACT.md) and [artifacts](../artifacts/SKILL.md). Real field evidence comes from people, not generated answers.

## Choose delivery mode

| Mode | Use | Artifact |
|---|---|---|
| on-site | Operator is available now | Live checklist; absorb answers the same day |
| pile | Existing materials answer most questions | Analyze pile; request only material gaps |
| trip | Evidence requires a later visit | Fillable DOCX, one stage per setting |

Record mode on the field phase. Markdown is always the questionnaire source. DOCX rendering is required only for trip delivery: `bun scripts/homework.mjs build docs/product/homework/<name>.md`. Do not create another generator.

## Prepare

Answer discoverable questions yourself first. Ask about recent actual events: walk through yesterday, show the last ten cases, demonstrate the last failure and the workaround. Avoid compliments, future-use promises and feature wishlists. Prioritize five questions; cap typed prompts around fifteen. Photograph relevant screens/forms only with the site's permission.

Include the operator, the owner of money/reporting and someone affected by the system. Capture task dependencies, exceptions, device/connectivity, data residency and human responsibility when relevant. If the incumbent is changing, baseline measurements come first.

Write `docs/product/homework/<nn>-<topic>.md` in stages. Each stage names who/where, questions as bullets, captures as checkboxes, and a concrete done-when. Move answered material under `## Closed`/`## Settled`; the renderer omits it. Rebuild trip DOCX after changes. Prose is instruction, not an answer box.

## Absorb

Read returned DOCX with `bun scripts/homework.mjs read <file>`; inspect answered counts before closing gaps. Photos go through salvage-inbox; keep originals and identifying data out of commits. Findings start with provenance: observation, recollection, committee, or explicitly authorized simulation.

Write `docs/research/field-<topic>.md`: observations, attributed verbatim quotes, contradictions, sourced facts and open gaps. Separate entity vocabulary from operational context. Never upgrade a recollection into an observation.

Freeze/anonymize the last ten real cases or a useful week/history sample in `docs/research/eval-set.md`. Cite source IDs, expected outcome, before-number and independent verifier. Include representative exceptions; ten is a starting sample, not statistical validation. Synthetic cases stay labeled and cannot close real field gaps.

Before marking done, reconcile outstanding homework and hard problems; remove answered asks and prioritize remaining ones. A gap accepted as an assumption stays visible. Return to `/next` to draft shape. Continue user research during build when new evidence changes the story.
