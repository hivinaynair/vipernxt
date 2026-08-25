# ViperNxt

Bun-only Turborepo boilerplate for a Next.js SaaS. See [README.md](README.md) for
layout, commands, and the customize-this-clone prompt — this file is the short
version agents need before touching anything.

## Constraints

- **Bun only.** `bun`, `bunx`, `bun test`. `only-allow bun` fails other installs.
  Do not add npm/pnpm/yarn, Vitest, or ESLint.
- **Feature-folder boundaries.** `apps/web/src` splits into `app` / `features` /
  `shared`. Features must not import each other — compose in `app/`, or hoist to
  `shared/` or a package. `bun run check-boundaries` enforces it.
- **shadcn/ui lives in `packages/ui`** (`@repo/ui`). Never install components
  into `apps/web`. Add with `bun run ui:add -- <component>`.
- **Env vars** are validated in `apps/web/src/env.ts` — import `env` from
  `@/env`, never `process.env`.
- **`@repo/db`** (Drizzle + Neon) is server-only: Server Components, Server
  Actions, Route Handlers, or `"use step"` functions.

## Vendors wired in

Auth: Clerk · Database: Drizzle ORM + Neon · Background work: Vercel Workflows ·
UI: shadcn/ui · Lint/format: Biome · E2E: Playwright.

A new product shape decides which of these to keep — record the decision, do not
strip anything outside the customize prompt.

## Before merging

```sh
bun run check-types && bun run check-boundaries && bun test
```

Branches: PRs target `staging`; `main` is production. Pushes to either run the
migrate workflow.

## Shaping a new product

The playbook ships in this clone under `.agents/skills/` (also linked from
`.cursor/skills/` and `.claude/skills/`). Type `/next`; it reads
`docs/product/state.yaml` and works out what happens now. Pin `/next` as a Custom Mode
for a shaping session so it stays in context. `status` is the glance. `shape` and
`design-system` read this file for the constraints above.

Until `shape` is `done`, do not edit product UI, routes, or features
(`apps/*/src/app`, `apps/*/src/features`). A project hook denies those writes. No state
file means no product yet — the boilerplate may be edited.
