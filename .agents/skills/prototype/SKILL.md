---
name: prototype
description: >-
  Builds three genuinely different versions of one component behind a picker, so a
  design question gets answered by looking instead of arguing. Use during build
  when a component's layout, density, or interaction model is undecided, or when
  the user dislikes how something feels and cannot say why.
---

# prototype

Adapted from [emilkowalski/skills](https://github.com/emilkowalski/skills/blob/main/skills/prototype/SKILL.md).

A design question that can be settled by looking should never be settled by
describing. Build the versions, put them behind a picker, let the user point.

**This is component-scale, during the build.** Product-scale visual direction — palette,
type, density for the whole product — is `design-system`, and it happens once. This
happens many times, whenever one component's shape is genuinely open.

## Scope it first

One component. Restate the brief in a single sentence and get agreement before building
anything. "How should the booking confirmation appear after the clerk hits save" is a
brief. "Improve the booking screen" is not.

## Recon before designing

Read the stack, the tokens, `DESIGN.md` if it exists, and the surrounding components.
A variant that ignores the design system is not a direction, it is a mistake.

## Divergence is the deliverable

Default to **three** variants, up to five. Before writing any code, name the **axis** they
differ on — layout, density, personality, motion, interaction model — and say what each
variant's answer is.

Three tints of the same idea waste the picker. Each variant must be defensible as
something you would ship, exploring a genuinely different answer to the brief.

**A sloppy variant teaches nothing.** It loses on execution rather than on direction, so
the user learns nothing about the approach it was meant to represent. Every variant gets
real interactions, realistic content — pull it from the field research, never lorem — and
proper motion: correct easing, under 300ms, and `prefers-reduced-motion` respected.

## The harness

Where there is a dev server, an isolated route: `/prototypes/<slug>`, one file per variant
plus the picker. Otherwise one self-contained HTML file.

**Never touch production code while exploring.**

Render variants **full size in realistic context** — a toast needs a page behind it, a
table needs enough rows to behave like a real one. Not thumbnails. Switching between them
is instant and unanimated; the picker is chrome, not a contestant.

## Present without choosing

State each variant's tradeoff: when it wins, and what it costs. Do **not** open with a
recommendation.

This is the one deliberate exception to the house rule of always recommending. Everywhere
else in this playbook you lead with a recommendation. For taste you do not, because nobody
can be argued into liking something, and a recommendation just makes agreement the path of
least resistance.

## Promote, then delete

Once they pick, integrate that variant following the project's conventions, then remove
the prototype route and its files. A prototype surface left behind becomes a second,
stale implementation of the component.

Record the choice and the axis in the decision log, so the same question is not reopened
in three weeks.
