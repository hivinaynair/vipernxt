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
Analytics: PostHog · Email: Resend · Files: Vercel Blob · UI: shadcn/ui ·
Lint/format: Biome · E2E: Playwright (intended; not scaffolded yet).

A new product shape decides which surfaces to scaffold from
[docs/kit/recipe.yaml](docs/kit/recipe.yaml) — record the decision, do not
strip a fat tree, and do not add a vendor the recipe does not name.

## Before merging

```sh
bun run check-types && bun run check-boundaries && bun run check-tokens && bun run check-journeys && bun test
```

`check-journeys` fails citations that are not spine IDs. Unbuilt served steps
do not fail a slice. When the clip is done: `bun run check-journeys -- --complete`.

Branches: PRs target `staging`; `main` is production. When `db` is scaffolded, pushes to either run the generated
migration workflow; the bare kit has no active migration workflow. Branch **from** `staging` too, and rebase onto it before the
merge bar — base and target must match. Hotfixes are the exception: branch from
`main`, land on `main`, back-merge the same day.

A PR body names the journey step IDs it landed and links its evidence. One that
cannot name a step is building something the spine does not describe.

## Building in parallel

Up to five agents at once, one slice each. Feature folders may not import each
other, so agents in different `src/features/<slug>/` cannot collide. Everything
else is shared surface — `src/app`, `src/shared`, `packages/*`, the schema, any
`package.json` — and **a slice touching shared surface runs alone**.

Schema, route shells and seed data land first, in wave 0, before any feature
slice. Feature slices never write a migration, and never create a page — every
feature needs a route, so a slice that makes its own takes the `src/app` lock
and stalls the other four. `bun scripts/journey.ts routes <spine.yaml>` prints
the shells wave 0 owes from the spine.

Work in your own worktree, not the shared checkout: with roughly a quarter of
agent pull requests hitting merge conflicts, isolation has to be structural
rather than each agent checking whether anyone else looks busy. At most one
shared-surface slice runs at a time, scheduled by the wave.

`docs/product/ontology.md` holds the canonical domain terms. They are the only
names allowed in tables, types, components, routes and UI copy — a rejected
synonym in the code is a defect.

## Shaping an engagement

The playbook ships in this clone under `.agents/skills/` (also linked from
`.cursor/skills/` and `.claude/skills/`). Type `/next`; it reads
`docs/product/state.yaml` and works out what happens now. The loop is
[docs/playbook/fde-loop.md](docs/playbook/fde-loop.md). The clone map is
[docs/map.md](docs/map.md). Pin `/next` as a Custom Mode
for a shaping session so it stays in context. `status` is the glance. `/next`
runs `customize` after the design doc, then the first working clip (Cursor Cloud preferred for implementation). A dedicated
product GitHub repository may be created for that cloud slice; full `setup.sh`
provisioning waits until they accept the slice. After the spine, `/next` runs `plan` then
`build`. Product contracts stay host-agnostic; Cursor-specific execution lives in its
factory adapter and requires Cursor API credentials. `shape` and `design-system` read this file for the constraints
above. The stack itself is [docs/kit/recipe.yaml](docs/kit/recipe.yaml) —
scaffold after U5; do not clone a second template and strip it.

Until `shape` is `done`, do not edit product UI, routes, or features
(`apps/*/src/app`, `apps/*/src/features`). A project hook denies those writes. No state
file means no engagement yet — the boilerplate may be edited. Live sites belong
on a throwaway clone, not in this kit.

Parallel child jobs are skills under [`.agents/skills/`](.agents/skills/) (`salvage-miner`,
`pile-reader`, …). Pi and Claude Code load them from that folder. On Cursor,
[`.cursor/agents/`](.cursor/agents/) is an extra Task adapter that pins **Cursor Grok 4.6**
— do not fan playbook work to Gemini. How to start a sibling: `next` skill, **Start a
child**. Serial in this session is allowed; skipping because the harness is not Cursor
is not.
