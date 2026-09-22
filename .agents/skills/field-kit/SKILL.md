---
name: field-kit
description: >-
  Writes the field-research homework — who to talk to, what to ask, what to
  observe, what to collect — then turns what comes back into cited findings. Use
  when the product serves people the user is not, before shaping something in an
  unfamiliar domain, or when the user returns from talking to real users.
---

# Field research

Input: salvage/research gaps. Output: homework or findings plus a cited eval set. Follow [CONTRACT.md](../CONTRACT.md) and [artifacts](../artifacts/SKILL.md). Real field evidence comes from people.

| Mode | Use | Artifact |
|---|---|---|
| on-site | Operator is available now | Live checklist; absorb the same day |
| pile | Existing materials answer most questions | Analyze; ask only the gaps |
| trip | Later visit | Fillable DOCX, one stage per setting |

Markdown is the questionnaire. Trip DOCX: `bun scripts/homework.mjs build docs/product/homework/<name>.md`. Eval-set rules: [fde-loop.md](../../../docs/playbook/fde-loop.md) U4.

## Prepare

Answer discoverable questions yourself. Ask about yesterday, the last ten cases, the last failure. Avoid compliments and wishlists. Five priority questions; ~15 typed prompts. Photograph screens only with permission. Include the operator, the money/reporting owner, and someone affected.

Observe one completed form and one real table decision for the [data-surface contract](../shape/data-surfaces.md). Write `docs/product/homework/<nn>-<topic>.md`: who/where, bullet questions, capture checkboxes, done-when. Move answered material under `## Closed`/`## Settled`.

## Absorb

`bun scripts/homework.mjs read <file>`. Photos through salvage-inbox; originals stay out of git. Findings start with provenance (observation, recollection, committee, authorized simulation). Write `docs/research/field-<topic>.md`. Freeze the last ten real cases in `docs/research/eval-set.md` — starting sample, not statistics. Synthetic cases stay labeled.

Return to `/next` to draft shape. Keep research going when new evidence changes the story.
