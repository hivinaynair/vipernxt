# Repository map

[README](../README.md) explains the two stages; [START](START.md) owns setup. [Recipe](kit/recipe.yaml) owns stack selection. /next reads product state and loads one phase skill.

| Path | Purpose |
|---|---|
| .agents/skills | Canonical concise skills, selectively loaded references and templates |
| .cursor/skills, .claude/skills | Aliases to the same skill source |
| .cursor/agents | Thin Cursor child adapters |
| .cursor/hooks, .cursor/rules | Shaping/branch guards and session context |
| scripts | Deterministic scaffolding, setup, journeys, readiness and development runner |
| deploy/eve | Independent hosted orchestrator, recovery, callbacks and tests |
| docs/kit | Recipe, overlays and product service setup |
| docs/playbook | Workflow and hash-bound handoff contracts |
| tooling | TypeScript, import boundaries and test mocks |
| test | Bun test preload; suites live beside sources |
| apps, packages, e2e | Product surfaces created when selected; absent from the bare starter |

Product artifacts appear in docs/product, docs/plans, docs/research and docs/journeys in your own clone. Private customer inputs and credentials stay outside Git.

[AGENTS](../AGENTS.md) owns implementation constraints and checks. [Workflow](playbook/fde-loop.md) owns phase order; [COVERAGE](../deploy/eve/COVERAGE.md) and [AUTOMATION](../deploy/eve/AUTOMATION.md) own factory verification/delivery contracts. GitHub/Linear tickets are views of those versioned requirements.

The UI hook gates shape status; requirements completeness additionally needs the packet review. Feature boundaries permit isolated work; shared foundations are serialized. Database scaffolding generates migration CI; no database means no migration workflow. Auth scaffolding includes Playwright helpers; live provider access still requires verification.
