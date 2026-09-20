---
name: status
description: >-
  Shows where the product stands in one short digest — phase, what is waiting on
  the user, what is next, and any drift between artifacts. Read-only. Use when the
  user asks where things are, what is pending, what they owe, or after time away.
---

Read-only: run `bun scripts/status.ts` and `bun scripts/check-drift.ts`. Present the digest and material contradictions without rewriting their meaning or changing state. State owns progress; do not reconstruct it from prose.

Distinguish waiting on the builder from waiting on the customer. No state means no engagement running. Missing installed skills are a harness gap, not missing on-disk artifacts. Keep the answer short; `/next` performs work. Do not add an interview or silently fix drift.
