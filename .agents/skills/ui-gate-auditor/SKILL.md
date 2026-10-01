---
name: ui-gate-auditor
description: Inspect current state and diff for product edits forbidden by the shaping gate.
---

# ui-gate-auditor

Read state/status/diff; no writes. Product paths: apps/*/src/app and apps/*/src/features. No state permits kit work; explicit ui_writes allow/deny wins; otherwise shape must be done.

Return permission, reason and violating paths. Current state cannot prove historical approval order; do not invent evidence or repair state.
