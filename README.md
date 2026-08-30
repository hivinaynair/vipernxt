# ViperNxt

An opinionated Bun + Next.js SaaS kit **and** the playbook that shapes a product
before anyone writes UI. Clone it, type `/next`, approve a design doc, then build
one journey through real data.

The valuable part is not the starter page. It is a hook that denies product UI
until the doc is approved, a journey spine that screens and tests cite, and one
command that runs the rest. Full map: [docs/map.md](docs/map.md). Agents:
[AGENTS.md](AGENTS.md).

**Requires** [Bun](https://bun.sh) `1.4.x`. Anything else fails (`only-allow bun`).

## What it is not

| Not this | Why |
|---|---|
| A demo SaaS to restyle | `apps/web` is leftover create-turbo copy until a product exists |
| A vendor catalog | The stack is decided. A product records keep/strip; it does not reopen the list |
| “Just start building” | Until `shape` is done, writes under `apps/*/src/app` and `src/features` are denied |
| A second journey file | A wrong product story reopens the design-doc table, then the spine. Same IDs |
| npm / pnpm / yarn, ESLint, Vitest, Prisma, NextAuth | Those fights are closed on purpose |

Billing and Clerk org UI are not in the tree. Add them when a product asks.

## Opinions worth keeping

These are the kit. `/next` may **strip** a vendor after the design doc says so.
It does not add a second option “just in case”.

| Layer | Use | Skip |
|---|---|---|
| Install | Bun `1.4.x` | npm, pnpm, yarn |
| App | Next.js 16, one `apps/web` | Extra apps until customize asks |
| Auth | Clerk | NextAuth, hand-rolled JWT |
| Database | Drizzle + Neon, import `env` from `@/env` | Prisma, `process.env` in app code |
| Jobs | Vercel Workflows | A second queue on day one |
| UI | shadcn in `packages/ui` | Components installed into `apps/web` |
| Lint | Biome | ESLint, Prettier |
| Test | `bun test`, Playwright | Vitest, Jest, Cypress |
| Branches | PRs → `staging`; `main` is production | Trunk-only until you change it on purpose |

Features must not import each other. Compose in `app/` or hoist to `shared/` or a
package. `bun run check-boundaries` enforces that.

## From clone

You type `/next`. You do not type `/customize` or `/journeys`.

| Step | Who | What |
|---|---|---|
| 1. Clone | you | New repo from this tree. Keep the opinions. |
| 2. `/next` | agent | Researches, then interviews one question at a time. Pin `/next` as a Custom Mode. |
| 3. Approve the design doc | you | Until then, product UI is locked. |
| 4. Name the clone | `/next` | Product name, then keep/strip. Writes `PRODUCT`. Never set up as `vipernxt`. |
| 5. `setup.sh` | script | One Neon project, `staging` + `production` databases, Vercel, Clerk, Linear. |
| 6. Journey spine | `/next` | Expands the Seat / Wants / Can click table into ID’d YAML. IDs never renumber. |
| 7. Thin slice | agent | One journey through real data before the full component inventory. |

If the journey is the **wrong product story** — too hard, wrong payoff, not what
you meant — say so. `/next` rewrites the clip and that table, you confirm, then
it expands the spine again. Same moment keeps `J1.S2`. A new beat gets a new ID.

`status` is the glance. After the spine, `/next` runs `plan` (one feature →
spec + slices) then `build` (one slice, tests name `J1.S3`). `prototype` is
three variants of **one** component, mid-build. None of those skills name a
host or a model as a prerequisite.

Playbook source: [saas-playbook](https://github.com/hivinaynair/saas-playbook).
In Cursor, the same picture is a canvas titled **ViperNxt map** (a view of
[docs/map.md](docs/map.md), not a second spec).

## Layout

| Path | Role |
|---|---|
| `apps/web` | Routes in `src/app`, domains in `src/features/*`, app-local in `src/shared` |
| `packages/ui` | shadcn (`@repo/ui`). `bun run ui:add -- <component>` |
| `packages/db` | Drizzle + Neon. Server-only. Schema empty until a product needs tables |
| `e2e/web` | Playwright |
| `docs/` | Design doc, journeys, this map — after `/next` |
| `.agents/skills/` | Playbook. `.cursor/skills/` and `.claude/skills/` are symlinks |

## Commands

```sh
bun install
bun run dev
bun run check-types && bun run check-boundaries && bun run check-tokens && bun run check-journeys && bun test
bun run ui:add -- button
bun run db generate && bun run db migrate
```

Lefthook runs Biome, boundaries, and affected typechecks on commit.

Env: copy `apps/web/.env.example` → `apps/web/.env.local`. Import `env` from
`@/env`, not `process.env`. Neon wants `DATABASE_URL` (pooled) and
`DATABASE_URL_UNPOOLED` (direct, for migrate).

## Branches

| Branch | Role |
|---|---|
| `staging` | Check-in. Open PRs here. |
| `main` | Production. Merge `staging` → `main` to release. |

Push to either runs [migrate.yml](.github/workflows/migrate.yml). Additive
migrations only. After the first `staging` push, make it the GitHub default
branch.

## Links

[Turborepo](https://turborepo.dev/docs) ·
[Next.js](https://nextjs.org/docs) ·
[Clerk](https://clerk.com/docs) ·
[Drizzle](https://orm.drizzle.team) ·
[Neon](https://neon.com/docs) ·
[shadcn/ui](https://ui.shadcn.com) ·
[Workflow DevKit](https://useworkflow.dev) ·
[Biome](https://biomejs.dev) ·
[Bun test](https://bun.com/docs/cli/test)
