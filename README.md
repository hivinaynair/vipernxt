# ViperNxt

Bun-only [Turborepo](https://turborepo.dev) boilerplate for a Next.js SaaS: one app (`apps/web`), shared UI, Clerk, Zod 4, [shadcn/ui](https://ui.shadcn.com), and Vercel Workflows. Clone it, shape the product, then answer the customize prompt below, then start building.

**Requires** [Bun](https://bun.sh) `1.4.x` (see `packageManager` in `package.json`). Installs with anything else will fail (`only-allow bun`).

## Layout

| Path | Role |
|------|------|
| `apps/web` | Next.js App Router (`src/app` routes, `src/features/*` domains, `src/shared`) |
| `packages/ui` | shadcn/ui (`@repo/ui`) — never install components into `apps/web` |
| `packages/db` | Drizzle ORM 1 (beta) + Neon (`@repo/db`) |
| `tooling/typescript-config` | Shared `tsconfig`s |
| `tooling/mocks` | Shared [MSW](https://mswjs.io/) handlers (`@repo/mocks`) |
| `tooling/dependency-cruiser` | Feature-folder import rules |
| `e2e/web` | Playwright for `web` |
| `test/` | `bun test` runner preload only (not a suite) |

Features must not import each other. Compose in `app/`, or hoist to `shared/` / `packages/`. `bun run check-boundaries` enforces that.

## Commands

```sh
bun install
bun run dev              # all apps
bun run build
bun run check-types
bun run check-boundaries
bun test
bunx playwright install chromium   # once
bun run e2e
bun run db generate
bun run db migrate
bun run db push
bun run db studio
bun run ui:add -- button   # shadcn CLI in packages/ui (Turbo)
```

Lefthook runs Biome, boundaries, and affected typechecks on commit (`lefthook install` via `prepare`).

Clerk keys: copy `apps/web/.env.example` → `apps/web/.env.local`, or use keyless in `next dev`. Env vars are validated by `@t3-oss/env-nextjs` in `apps/web/src/env.ts` — import `env` from `@/env` instead of `process.env`. Typecheck sets `SKIP_ENV_VALIDATION=1` so it can run without secrets.

Neon: set `DATABASE_URL` (pooled, hostname has `-pooler`) for the app and `DATABASE_URL_UNPOOLED` (direct) for `db:migrate` / `db:push`. Schema lives in `packages/db`. Import `db` from `@repo/db` only in Server Components, Server Actions, Route Handlers, or `"use step"` functions.

## Branches and production migrate

| Branch | Role |
|--------|------|
| `staging` | Check-in branch. Open PRs against this. |
| `main` | Production (customers). Merge `staging` → `main` to release. |

On every push to `staging` or `main`, [Migrate database](.github/workflows/migrate.yml) runs `bun run db migrate` (`drizzle-kit migrate`). It is a no-op when nothing is pending, and it skips entirely until `packages/db/drizzle/meta/_journal.json` exists.

Create GitHub Environments named `staging` and `production`. Each needs a secret `DATABASE_URL_UNPOOLED` pointing at a **different** Neon database (direct hostname, no `-pooler`). Vercel still deploys from Git; keep migrations additive (expand/contract) so the running app stays compatible. A failed migrate job does not roll back the deploy — fix forward, and do not merge to `main` until the same files have already migrated on staging.

After the first push of `staging`, set it as the GitHub default branch so new PRs target it.

## Shape the product

Before renaming packages or writing product UI, shape the SaaS: interview, research, user journeys, low-fi screens, then a design doc. Invoke the **shaping-saas** skill (Cursor, Claude Code, or any agent that reads `.agents/skills`), or ask the agent to shape the product. It asks one question at a time, writes the design doc as it goes so a shape survives a lost session, and does not start implementing until you say the doc is right. The design-canvas step is Cursor-only and skips elsewhere.

The rename / strip-Clerk checklist is the next section — keep that separate.

## Customize this clone

Paste the following into Cursor (or any coding agent) in this repo. It should **ask these questions one at a time**, then apply the answers. Skip anything you want to leave as-is.

````markdown
You are customizing this ViperNxt clone. Use Bun only (`bun`, `bunx`, `bun test`).
Do not add Vitest, ESLint, or another package manager. Keep feature-folder
boundaries (`app` / `features` / `shared`). After edits: `bun install`,
`bun run check-types`, `bun run check-boundaries`.

Ask one question at a time. Wait for the answer before the next.

1. Product name (human title) and repo/package name (npm-safe, e.g. `acme`)?
   Today the root package is `vipernxt`. Rename `package.json`, README title,
   and any user-facing “ViperNxt” / “Create Next App” copy.

2. Workspace scope instead of `@repo` (e.g. `@acme`)? Update every
   `package.json` `name` / dependency and tsconfig `extends`.

3. Rename `apps/web` (and matching `e2e/web`)? Keep `web` if unsure.
   Update workspace names, Playwright `webDir`, filters, and docs.

4. Extra Next.js apps now (e.g. `marketing`, `admin`)? Scaffold the same
   `src/app` + `src/features` + `src/shared` layout, or skip.

5. Auth: keep Clerk, strip it, or keep it and enable organizations (B2B)?
   Stripping must remove `@clerk/nextjs`, `src/proxy.ts`, `ClerkProvider`,
   `features/auth`, and env examples.

6. Keep Vercel Workflows (`workflow` + `withWorkflow` in `next.config`)?
   Remove the package and wrapper if not.

7. Default site metadata (title, description, `lang` on `<html>`)?

8. Database: keep Drizzle + Neon (`@repo/db`), or strip it?

9. Keep the `shaping-saas` skill? It talks about "this ViperNxt clone" and
   `@repo`, so it goes stale once you have shaped. Keep it for the next
   product, or delete `.agents/skills/shaping-saas` and the
   `.claude/skills/shaping-saas` symlink.

Apply only what was answered. Do not invent a product or UI kit.
````

Later, when you add billing, extend this prompt — that is not in the tree yet.

## Links

- [Turborepo](https://turborepo.dev/docs)
- [Next.js](https://nextjs.org/docs)
- [Clerk](https://clerk.com/docs)
- [Drizzle ORM](https://orm.drizzle.team)
- [Neon](https://neon.com/docs)
- [shadcn/ui](https://ui.shadcn.com)
- [Workflow DevKit](https://useworkflow.dev)
- [Biome](https://biomejs.dev)
- [Bun test](https://bun.com/docs/cli/test)
