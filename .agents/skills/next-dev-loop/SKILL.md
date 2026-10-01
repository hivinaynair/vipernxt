---
name: next-dev-loop
description: Verify changed Next.js journeys in a real browser and inspect available runtime diagnostics.
---

# next-dev-loop

Read actual dev-server URL/version and worktree ownership. Avoid rereading the whole application.

1. Discover /_next/mcp via JSON-RPC tools/list (JSON Content-Type; Accept JSON/SSE). Use returned schemas; capabilities vary.
2. For agent-browser, load `agent-browser skills get core`, derive a worktree-scoped session and inspect installed help. React introspection is optional.
3. Navigate before querying runtime errors. Drive input rejection/recovery, persistence and affected mobile layouts. Re-snapshot after changes; restore viewport.
4. Capture relevant compilation/error evidence and screenshots/traces. Parse SSE data payloads when needed.

Missing MCP support means use logs, not a forced upgrade. Missing browser means report unverified interactive behavior; HTTP success is insufficient. Resolve stale sessions/tools before changing application code.

Use authorized test identities, never guessed preview-login routes or secret-bearing links. Do not weaken production auth. Close only your browser session; leave the owned dev server unless asked otherwise.
