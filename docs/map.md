# ViperNxt map

Clone this repo, type `/next`, then run the customize prompt. Do not invent a
product UI first. The stack stays: Bun, Clerk, Drizzle + Neon, shadcn in
`packages/ui`, Vercel Workflows, Biome, Playwright.

This file is the map a future clone reads. The Cursor canvas is a view of it.

## Start a product

| Step | Who | What |
|---|---|---|
| 1. Clone | you | New repo from this tree. Keep the opinions. |
| 2. `/next` | agent | Creates `docs/product/state.yaml`, researches, interviews one question at a time. Pin `/next` as a Custom Mode. |
| 3. Approve the design doc | you | Until `shape` is `done`, a hook denies writes under `apps/*/src/app` and `apps/*/src/features`. |
| 4. Customize | you + agent | Paste the prompt in [README.md](../README.md). Rename, keep or strip vendors. Record the choice; do not silently drop Clerk or Neon. |
| 5. `setup` | script | [`.agents/skills/setup/setup.sh`](../.agents/skills/setup/setup.sh) — GitHub, two Neon projects, Vercel link, Clerk keys, Linear team key. Not agent tool calls. |
| 6. Journey spine | agent | `journeys` writes `docs/journeys/<name>.yaml`. IDs are permanent. |
| 7. Thin slice | agent | One journey through real data before the full component inventory. |

`status` is the glance. `setup` provisions. `shape` does not rename packages.

## Repo

| Path | Role |
|---|---|
| `apps/web` | Next.js 16 App Router. Routes in `src/app`, domains in `src/features/*`, app-local code in `src/shared`. Composition also in `src/proxy.ts`. |
| `packages/ui` | shadcn/ui (`@repo/ui`). Add with `bun run ui:add -- <component>`. Never install components into an app. |
| `packages/db` | Drizzle ORM 1 (beta) + Neon (`@repo/db`). Server-only. Schema is empty until a product needs tables. |
| `tooling/typescript-config` | Shared `tsconfig`s. |
| `tooling/mocks` | Shared MSW handlers (`@repo/mocks`). Started from `test/setup.ts`. |
| `tooling/dependency-cruiser` | Feature-folder import rules. `bun run check-boundaries`. |
| `e2e/web` | Playwright. Import `test`/`expect` from that app’s `playwright.setup`. |
| `test/` | `bun test` preload only. Suites are colocated `*.test.ts(x)`. |
| `docs/` | Product artifacts after `/next`. This map. Research notes. |
| `.agents/skills/` | Playbook + vendor skills. Source of truth. Vendored from [saas-playbook](https://github.com/hivinaynair/saas-playbook). |
| `.cursor/skills/`, `.claude/skills/` | Symlinks to `.agents/skills/` so Cursor and Claude Code both see them. |
| `.cursor/agents/` | Playbook subagents. Cursor Grok 4.6 only. |
| `.cursor/hooks/` | UI gate + session digest. |
| `.cursor/rules/` | Always-on playbook rule; feature, shadcn, testing, next-dev-loop. |

Features must not import each other ([`tooling/dependency-cruiser/nextjs.mjs`](../tooling/dependency-cruiser/nextjs.mjs)). Compose in `app/` or hoist to `shared/` or a package.

## Stack (do not reopen)

| Layer | Choice | Skip |
|---|---|---|
| Runtime / install | Bun `1.4.x` (`only-allow bun`) | npm, pnpm, yarn |
| App | Next.js 16 App Router, one `apps/web` | Extra apps until customize asks |
| Auth | Clerk (`src/proxy.ts`, `ClerkProvider`) | NextAuth, custom JWT |
| Database | Drizzle + Neon, validated via `@/env` | Prisma, `process.env` in app code |
| Jobs | Vercel Workflows (`withWorkflow`) | A second queue until a product needs one |
| UI | shadcn in `packages/ui`, Tailwind 4 | Components in `apps/web` |
| Lint / format | Biome | ESLint, Prettier |
| Unit test | `bun test` + Testing Library | Vitest, Jest |
| E2E | Playwright | Cypress |
| Branches | PRs → `staging`; `main` is production | Trunk-only until you change it on purpose |

A new product shape records keep/strip. The customize prompt applies it. Nothing else strips vendors.

## Playbook

Type `/next`. It reads `docs/product/state.yaml` and does every step that is not a human decision or a real-world fact. Skills live in [`.agents/skills/`](../.agents/skills/).

| Skill | Job |
|---|---|
| `next` | Router. Runs the current phase. One held item at a time. |
| `status` | Read-only glance. Also injected on local `sessionStart`. |
| `artifacts` | House rules for anything under `docs/product`, `docs/plans`, `docs/research`, `docs/journeys`. |
| `salvage` | Mine prior art for domain facts. |
| `field-kit` | Homework only they can fill; then absorb what comes back. |
| `shape` | Interview → design doc. Canvas is a view of that doc. |
| `ontology` | Domain entities before schema or spine. |
| `journeys` | ID’d YAML spine + generated Mermaid. |
| `linear-sync` | Spine → Linear issues. IDs come back; nothing else. |
| `design-system` | Layout primitives and semantic tokens before pages. |
| `prototype` | Three variants of one component, mid-build. |
| `setup` | Runs `setup.sh`. Does not improvise infra. |
| `next-dev-loop` | Runtime verify after app edits (`/_next/mcp` + browser). |
| `turborepo` | Vendor skill for the monorepo. |

Phases, from [`next/SKILL.md`](../.agents/skills/next/SKILL.md): salvage → research → field → shape → ontology → journeys → structure / visual → Linear → build. Ship one walking skeleton after the spine exists. `prototype` is not a phase.

No `docs/product/state.yaml` means no product. Boilerplate may be edited. This repo is in that state.

## Harness

| Piece | Path | Does |
|---|---|---|
| UI gate | [`.cursor/hooks/playbook.py`](../.cursor/hooks/playbook.py) `gate` | Denies Write/StrReplace/Delete under `apps/*/src/app` and `apps/*/src/features` until `shape` is `done` (or `ui_writes: allow`). Fail-closed. Missing state file = boilerplate, allowed. |
| Session digest | same file, `session` | Injects a `status` glance. Cloud chats do not run `sessionStart`; the playbook rule still applies. |
| `salvage-miner` | [`.cursor/agents/salvage-miner.md`](../.cursor/agents/salvage-miner.md) | One prior-art source. Facts, not structure. |
| `domain-researcher` | [`.cursor/agents/domain-researcher.md`](../.cursor/agents/domain-researcher.md) | One research thread. Parent files the note. |
| `spine-checker` | [`.cursor/agents/spine-checker.md`](../.cursor/agents/spine-checker.md) | Validates `docs/journeys/*.yaml`. |
| `ui-gate-auditor` | [`.cursor/agents/ui-gate-auditor.md`](../.cursor/agents/ui-gate-auditor.md) | Reports gated-path edits. Does not fix. |

Subagents do not inherit skills. Pass `.agents/skills/<name>/SKILL.md` in the task prompt. Do not send playbook work to Gemini.

Rules: [`.cursor/rules/playbook.mdc`](../.cursor/rules/playbook.mdc) (always), `next-features`, `shadcn`, `testing`, `next-dev-loop`.

## Checks

Local, on commit ([`lefthook.yml`](../lefthook.yml)): Biome, boundaries, affected typechecks.

Declared merge bar ([`AGENTS.md`](../AGENTS.md)):

```sh
bun run check-types && bun run check-boundaries && bun test
```

CI: [`.github/workflows/check.yml`](../.github/workflows/check.yml) on PRs and on `staging`/`main`. [`.github/workflows/migrate.yml`](../.github/workflows/migrate.yml) applies Drizzle on push to those branches. No journal yet = skip.

## Open gaps

Ranked. Stack is not on this list.

| # | Gap | Why it matters |
|---|---|---|
| 1 | Customize is a paste prompt, not a skill | Agents forget it. `setup.sh` provisions under the old `vipernxt` names. |
| 2 | Feature-tier skills named, not shipped | `shape` and `journeys` hand off to `worth-it` → `nah-fam` → `game-plan` → `lets-cook`. Those files are not in `.agents/skills/`. After the spine, `/next` has no build skill. |
| 3 | Nothing consumes journey IDs | [docs/research/agent-native-product-shaping.md](research/agent-native-product-shaping.md) §2: a spine no test names will rot. |
| 4 | `design-system` asks for a raw-token check | No Biome/lint rule fails a raw palette value in `className`. |
| 5 | Starter leftovers | `apps/web` metadata is still “Create Next App”. Home copy points at `apps/web/app/page.tsx` (wrong path). E2E clicks a dead “Open alert” button. |
| 6 | Billing not in the tree | README says extend the customize prompt later. Keep it out until a product asks. |
| 7 | Clerk orgs are a setup flag only | Customize asks B2B; app code has no org helpers yet. Fine until a product is B2B. |

Do not add npm, Vitest, ESLint, or a second UI kit to close any of these.
