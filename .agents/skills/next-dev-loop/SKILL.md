---
name: next-dev-loop
description: >
  Verify Next.js runtime behavior after editing app code. Use this
  skill to confirm a change actually works in a running app — not
  just that it compiles or type-checks. Combines /_next/mcp
  (Next.js's view) with agent-browser (the browser's view).
  Requires a running `next dev`.
---

# Verify a running Next application

Input: owned dev server and changed journey. Output: compilation/runtime evidence plus observed browser behavior. Do not start by reading the whole application again.

1. Read the actual server URL/version from its banner; confirm process/worktree ownership.
2. Discover `/_next/mcp` with JSON-RPC `tools/list` (`Content-Type: application/json`, `Accept: application/json, text/event-stream`). Use the returned tool schemas. Next 16.3+ exposes compilation issues; available tools vary by version.
3. Use a real browser. For agent-browser, first run `agent-browser skills get core` for version-matched syntax; derive an isolated session with `agent-browser session id --scope worktree --prefix verify` and use it consistently. Current React support uses `open --enable react-devtools`; inspect installed help instead of assuming flags.
4. Navigate the route before checking runtime errors. Drive the served steps, including input rejection/recovery and persisted results where relevant. Re-snapshot after changes; refs become stale. Test affected mobile layouts and restore viewport afterwards.
5. Query available compilation/error tools and capture screenshots or traces appropriate to the claim. React introspection is optional and never substitutes for visible behavior.

A missing MCP feature does not mandate a framework upgrade: use the available compilation logs and real browser. A missing browser prevents claiming browser verification; return that evidence gap to the caller. Never replace an interactive test with a successful HTTP response alone.

If a browser session is blank/stale, reopen it with the same scoped restore context, then close/reopen if necessary. Reconcile tool/session problems before changing app code. Use exact observed URLs rather than guessed navigation waits. MCP responses may be SSE; parse the `data:` JSON payload.

For authentication, use a configured test identity/session; do not assume `/api/preview-login` exists or put secrets in shared links. Do not weaken production authentication for screenshots. Close only your browser session when done; leave the owned dev server available unless asked otherwise.
