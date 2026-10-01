---
name: linear-sync
description: Optionally sync the canonical journey spine to Linear without duplicate tickets or policy drift.
---

# linear-sync

Follow [CONTRACT](../CONTRACT.md). Git owns behavior/scope; Linear owns assignment/planning. Input: validated spine and product team.

```sh
bun scripts/journey.ts validate docs/journeys/<name>.yaml
bun scripts/linear-sync.ts plan docs/journeys/<name>.yaml
bun scripts/linear-sync.ts record docs/journeys/<name>.yaml F2 TEAM-42
```

Reconcile exact product/feature before creation; record returned IDs immediately. Use generated bodies; preserve assignee/state/cycle/estimate unless assigned. Subissues follow actual slices. Specs remain versioned with code.

Use an available authenticated adapter; do not assume a host connector or request unnecessary keys. Linear is optional; unattended sync requires a headless adapter. Publication follows slice acceptance/existing authorization.

Compare board criteria/orphans/shipped steps against the spine; local check-drift cannot read the board. Return material discrepancies to /next; ticket changes cannot redefine accepted behavior.
