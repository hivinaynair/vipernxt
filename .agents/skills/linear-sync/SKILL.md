---
name: linear-sync
description: >-
  Publishes the features in the journey spine to Linear as issues carrying their
  journey step ids and acceptance criteria, writes the issue ids back into the
  spine, and reports drift between the two. Use after the spine is confirmed, when
  the user asks to push work to Linear, or to check Linear against the spine.
---

# Publish the spine to the work board

The Git spine owns behavior/scope; Linear owns human assignment and planning fields. Follow [execution contract](../CONTRACT.md). Input: validated spine and configured product team. Output: generated create/update plan and immediately recorded issue IDs.

```sh
bun scripts/journey.ts validate docs/journeys/<name>.yaml
bun scripts/linear-sync.ts plan docs/journeys/<name>.yaml
bun scripts/linear-sync.ts record docs/journeys/<name>.yaml F2 TEAM-42
```

Use generated bodies verbatim. Before creation, reconcile the exact product/feature against existing issues; a bare F2 prefix across products is not enough. Record the returned ID immediately so retries do not create duplicates. Preserve state, assignee, cycle and estimate unless the current task explicitly owns them. Sub-issues arise from the actual slice plan, not a speculative backlog.

Use an available authenticated connector for interactive sync. Do not assume every host has it. An unattended supervisor needs an explicitly configured headless tracker adapter; until then repository job contracts can run locally without Linear. Do not request unnecessary API keys or pretend a connector is available. Team creation follows the adapter's actual capabilities and existing authorization.

For drift, compare issue criteria, orphan issues and changed shipped steps against the spine; local `check-drift` cannot read the board. Report material product drift to `/next`; ticket edits do not silently redefine the product. Specs remain versioned with code. Setup/ticket publication wait until first slice acceptance unless already authorized.
