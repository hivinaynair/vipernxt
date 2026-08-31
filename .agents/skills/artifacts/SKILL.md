---
name: artifacts
description: >-
  House rules for every document this playbook writes — brevity, precision, and
  the length caps per artifact. Use before writing or editing any file under
  docs/product, docs/plans, docs/research, or docs/journeys.
---

# artifacts

Every document here is read by a person under time pressure and by an agent with a
context budget. Both are punished by filler. A document nobody reads has the same value
as no document, and cost more to make.

## The test

**Delete any sentence that can be deleted without losing information.** If removing it
changes nothing a reader would act on, it was filler. Apply this to your own draft before
saving, not as a later pass.

Brevity is not omission. Every fact that someone downstream needs must be present. The
target is density, not shortness — say everything, in the fewest words that still say it.

## Rules

**Front-load.** First line is the finding, verdict or answer. Not context, not the
question restated, not what the document is about.

**Tables for anything parallel.** Three or more items with the same shape belong in a
table. Prose comparing three things is a table someone refused to draw.

**Every fact carries its source, inline.** A file path, a commit, a photograph, a quoted
role, a URL. Never "research shows", "it turns out", or "we found". An uncited claim is a
memory, and memories are what these documents exist to replace.

**Bullets are claims, not topics.** "Receipts must carry the trust registration number
(photo 04)" — not "Receipt requirements".

**No throat-clearing.** Delete: *in this section*, *it is important to note*, *as
mentioned above*, *broadly speaking*, *at a high level*, and every transition sentence
between sections. Headings already do that job.

**No hedging that carries no information.** "May potentially be somewhat relevant" is four
words of nothing. Either it matters, or it doesn't, or you don't know and say so plainly.

**Open questions get their own section, always.** What you could not resolve is as
valuable as what you could, and it is what the next phase acts on.

**Date and version anything researched.** "Cursor 2.4, checked 2026-08-25". Facts about
software rot within weeks.

## Caps

Exceeding a cap is a signal that the document is doing more than one job. Split it or cut
it — do not just let it grow.

| Artifact | Cap | Shape |
|---|---|---|
| `salvage.md` | 2 pages | Facts table, then vocabulary, then what was abandoned, then open questions |
| research note | 2 pages | Findings first, each cited; contested claims show both sides |
| field findings | 2 pages | Observations, then quotes, then contradictions, then open |
| `ontology.md` | Entity table + one block each | Table first; blocks only for entities with real states |
| design doc | **2 pages** | See the template |
| `DESIGN.md` | 1 page | Roles, scale, density, taste rules |
| homework | 1 page per stage | Form to fill, not prose to read |
| state.yaml | no cap | Structured; caps do not apply |

## What this does not apply to

The journey spine and the state file. Those are structured data and completeness beats
brevity — every step, every state, every transition, even the boring ones. The generated
markdown from the spine is also exempt; it is output, not writing.

## Before saving anything

1. Does the first line say the answer?
2. Is every claim sourced?
3. Would deleting any sentence lose information? Delete the ones that would not.
4. Is anything parallel still prose? Make it a table.
5. Is it under the cap?
