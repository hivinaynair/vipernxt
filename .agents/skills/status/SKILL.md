---
name: status
description: >-
  Shows where the product stands in one short digest — phase, what is waiting on
  the user, what is next, and any drift between artifacts. Read-only. Use when the
  user asks where things are, what is pending, what they owe, or after time away.
---

# status

A read-only digest. Answers "where are we" without doing any work or changing anything.

Read `docs/product/state.yaml`. Read nothing else unless a check below needs it. Never
reconstruct state by reading prose.

## Output

Four sections, in this order, and nothing else. If a section is empty, omit it entirely
rather than printing "none".

**Waiting on you** — open held items, most blocking first. Each: what is needed, and how
long it has been open. This section goes first because it is the only one that requires
action from them.

**Where we are** — the current phase, one line on what it is doing, and what is finished.
A compact line, not a phase-by-phase table: `done: salvage, research · now: field ·
next: shape`.

**Deferred** — items with an `until` date, and when they resurface.

**Drift** — contradictions only: a phase marked done whose artifact is missing, a Linear
issue with no journey step, a feature with no issue, criteria that no longer match the
spine. Report; change nothing.

## Rules

Keep the whole thing under roughly fifteen lines. This is a glance, not a report. If
there is genuinely more to say, say the most important thing and offer the rest.

No preamble, no "here is your status", no closing summary. Start with the first section.

Never use internal vocabulary — no "held item", "state file", "gate", "phase 3.5". Say
what is waiting on them in the words they would use.

Do not do work. If a phase could advance, say so in one line and stop; `next` runs it.

## When nothing is happening

If no state file exists, say there is no product being shaped here and offer to start one.
Do not print an empty digest.
