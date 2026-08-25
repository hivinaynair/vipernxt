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

A `sessionStart` hook injects the same glance into local chats. Cloud sessions do not
run `sessionStart`; the always-on `playbook` rule covers them. Still run this skill
when asked.

## Output

Sections in this order, and nothing else. If a section is empty, omit it entirely
rather than printing "none".

**Waiting on you** — open items, most blocking first. Each: what is needed, and how
long it has been open. This section goes first because it is the only one that requires
action from them.

**Where we are** — the current phase, one line on what it is doing, and what is finished.
A compact line, not a phase-by-phase table: `done: salvage, research · now: field ·
next: shape`.

**Deferred** — items with an `until` date, and when they resurface.

**Do not** — one sentence when product UI must not be written: do not edit
`apps/*/src/app` or `apps/*/src/features` until the design doc is approved. Omit this
section once `shape` is `done` (or `ui_writes: allow`). When omitted, skip it; do not
print that writes are allowed unless they ask.

**Harness** — only if `next`, `status`, or `shape` are missing from your skill list:
say the playbook files are on disk (`.agents/skills/`, `.cursor/skills/`) but were not
offered as skills. Omit if those skills are in your list.

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
Do not print an empty digest. Do not tell them to type `/next` unless that skill is in
your list.
