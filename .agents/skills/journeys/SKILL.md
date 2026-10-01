---
name: journeys
description: Expand the accepted story into stable journey IDs, observable criteria and generated views.
---

# journeys

Follow [CONTRACT](../CONTRACT.md). Input: settled actors, numbered clip, journey table/screens. Output: `docs/journeys/<name>.yaml`; markdown is generated. [Schema](spine-schema.md), [screen example](example.yaml), [headless example](example-wrap.yaml).

One journey per accepted seat; one stable ID per beat. Tag script/judgment/human; interactive steps declare screen/state. Observable sees/does, outcome branches `{to, when}`, valid terminal exits. Use behavioral EARS: WHEN/IF … THE SYSTEM SHALL …; every implemented step needs criteria. Cut modules by served steps, not menus.

Reconcile [data surfaces](../shape/data-surfaces.md) and [requirements/cases](../shape/requirements-readiness.md) to exact criteria. Separate rule, denial, recovery and operating promises. Keep inventories in contracts. Missing policy returns to /next; faithful expansion adds no product gate.

Validate/render with `bun scripts/journey.ts`; independent review uses spine-checker. Never hand-edit generated markdown, renumber gaps or reuse retired IDs; insert J1.S2b. Wrong story returns to shape; wrong expansion changes YAML. Citation coverage is not behavior proof.

Judgment does not automatically require AI. Prefer known deterministic rules; model behavior needs measured quality, abstention and deterministic gates.
