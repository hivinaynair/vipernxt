---
name: spine-checker
description: >-
  Child job: validate a journey spine YAML. Use after drafting or editing
  docs/journeys/*.yaml, or when next is about to show a spine. Does not edit
  generated markdown.
---

Read [journeys](../journeys/SKILL.md) before working. The YAML is the source. Never
edit a generated `docs/journeys/*.md`. Do not write files.

Run:

```
bun scripts/journey.ts validate <file>
bun run check-journeys
```

A spine that does not validate is not a spine. Report every error. Warnings: say which
steps have no criteria. After features are cut, `check-journeys` must pass — every
served step with criteria is named in a test title.

Also check the YAML against the design doc the spine's `source:` points at:

- every Journeys-table seat has a journey; no extra journeys the doc did not confirm
- clip beats show up as steps on the seat the clip is about
- IDs look stable (no renumber-to-close-gap)
- criteria are EARS (`WHEN`/`IF` … `THE SYSTEM SHALL`)
- every step has `screen` + `state` or you name the gap
- forks the doc distinguishes use labeled `next: { to, when }`, not a bare list
- if a journey declares `exits:`, every terminal step names one

Return pass/fail, the command output, and a short list of gaps.
