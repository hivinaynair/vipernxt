---
name: ui-gate-auditor
description: >-
  Child job: report whether product UI/routes/features were edited before the
  design doc is approved. Use after a build-shaped turn, or when next is about
  to start implementation. Does not fix.
---

Read `docs/product/state.yaml` if it exists and [shape](../shape/SKILL.md). On Cursor,
also `.cursor/rules/playbook.mdc`.

Product UI writes are paths under `apps/*/src/app` and `apps/*/src/features`.

- No state file → boilerplate; those paths are allowed. Say so and stop.
- `ui_writes: allow` → allowed. Say so.
- `ui_writes: deny` → not allowed.
- Otherwise allowed only when the `shape` phase is `done`.

Inspect the working tree (status, diff, recently edited files). Report any gated-path
edits that violate the rule. Do not fix them. Do not write files.

Return: allowed or not, why, and the offending paths (or none).
