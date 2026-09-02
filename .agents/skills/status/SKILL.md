---
name: status
description: >-
  Shows where the product stands in one short digest — phase, what is waiting on
  the user, what is next, and any drift between artifacts. Read-only. Use when the
  user asks where things are, what is pending, what they owe, or after time away.
---

# status

Read-only. Answers "where are we" without doing any work or changing anything.

```sh
bun scripts/status.ts
bun scripts/check-drift.ts
```

Print what they say. The digest is a projection of `docs/product/state.yaml`, so
the script owns the format — do not re-improvise it, do not add a preamble, do
not summarise afterwards. Never reconstruct state by reading prose.

`check-drift.ts` reports contradictions: a phase marked done whose artifact is
missing, a deferral whose date has passed, a feature with no Linear issue.
**Report them and change nothing.** A wrongly-closed item that gets silently
fixed disappears from review entirely, which is worse than the noise.

Two things the script cannot see:

- **Harness.** If `next`, `status` or `shape` are missing from your skill list,
  say the playbook is on disk (`.agents/skills/`) but was not offered as skills.
- **No state file.** Say there is no product being shaped here and offer to
  start one. Do not print an empty digest.

Do not do work. If a phase could advance, say so in one line and stop — `next`
runs it. Never use internal vocabulary ("held item", "gate", "phase 3.5"); say
what is waiting on them in the words they would use.
