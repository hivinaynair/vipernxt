---
name: spine-checker
description: >-
  Child job: reconcile a requirements packet or validate a journey spine YAML.
  Use before design approval, after drafting docs/journeys/*.yaml, or before
  implementation handoff. Reads assigned contracts and evidence; no file writes.
---

Read only assigned inputs; no file writes. For a requirements review, use [readiness](../shape/requirements-readiness.md) and [acceptance](../shape/requirements-acceptance.md): check applicable area coverage, evidence versus assumptions, field/model/access consistency, exceptions and traceability. Report material unknowns; never approve policy for the customer. A pre-spine review uses design beats and does not require nonexistent YAML.

For a spine review, read the assigned YAML and its source design table/clip plus linked requirements/cases. Run `bun scripts/journey.ts validate <file>` and `bun run check-journeys`. Do not use `--complete` for an unbuilt draft.

Check seat/beat fidelity, stable IDs, EARS, labeled outcome branches and valid terminal exits. Interactive steps need declared screen/state; headless script/judgment or out-of-band human steps do not. Report missing criteria even if the validator calls them warnings.

Return pass/fail, concise command evidence and actionable gaps. Never edit generated markdown or invent a new product story to repair an expansion.
