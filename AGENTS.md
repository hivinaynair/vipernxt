# ViperNxt agent rules

Read [README](README.md) for purpose and [START](docs/START.md) for credentials. No product state means starter maintenance; active engagements use /next and [CONTRACT](.agents/skills/CONTRACT.md).

- Bun only: bun/bunx/bun test. No npm/pnpm/yarn, Vitest or ESLint.
- Scaffold approved surfaces/facets from [recipe](docs/kit/recipe.yaml); no extra template or speculative vendors.
- Features never import each other; compose in app, shared or packages.
- shadcn lives in packages/ui (@repo/ui); use `bun run ui:add -- <component>`.
- Product env is validated through @/env. Database imports are server-only.
- Canonical domain terms come from docs/product/ontology.md.
- No product UI/routes/features until shape is done, unless the explicit ui_writes override applies. Never bypass hooks.
- Before schema/UI, resolve material scoped requirements: entities/lifecycle, fields/displays, rules/access, integrations, operations and acceptance. Approval binds contracts; missing policy returns to /next.
- Review the first working slice before remaining factory work. Existing authorization persists; do not add repeated go/approval prompts.
- Branch from staging and target staging; main is production. Hooks prohibit main pushes/PRs. Hotfix/release policy requires explicit owner handling.
- Work in isolated worktrees. Wave 0 owns schema/routes/seed/layout; shared-surface slices run alone. Independent feature slices may run concurrently within the approved scheduler limit.
- PRs cite served journey IDs, tested SHA and evidence. Changed commits need fresh verification.
- Skills live in .agents/skills; Cursor/Claude paths are aliases. Cursor child adapters pin Grok 4.6; other hosts may execute serially.
- Keep credentials/raw customer data out of Git. Product experiments belong in dedicated clones.

Merge bar:

```sh
bun run check-types && bun run check-boundaries && bun run check-tokens && bun run check-journeys && bun run check-skills && bun test
```

Run affected production builds/browser paths. Final clip also runs check-journeys -- --complete. Citation validation does not prove behavior. DB scaffolding generates migration CI; the bare starter has none.
