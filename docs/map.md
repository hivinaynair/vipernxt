# ViperNxt map

Clone this repo, type `/next`. It names the clone when the design doc is
approved — you do not type `/customize`. Do not invent a product UI first. The
stack stays: Bun, Clerk, Drizzle + Neon, shadcn in `packages/ui`, Vercel
Workflows, Biome, Playwright. The engagement order is
[playbook/fde-loop.md](playbook/fde-loop.md).

This file is the map a future clone and an agent read. The GitHub
[README](../README.md) is the public scan. The Cursor canvas **ViperNxt map**
is a view of this file — not a second spec.

## Start an engagement

| Step | Who | What |
|---|---|---|
| 1. Clone | you | Throwaway clone for a live site. Keep the opinions. Do not park a customer in the kit. |
| 2. `/next` | agent | Creates `docs/product/state.yaml`, incumbent gate, salvage, field. Pin `/next` as a Custom Mode. |
| 3. Confirm U5 | you | Outcome, who has the pain, why the obvious build is wrong. Until `shape` is `done`, a hook denies product UI. |
| 4. Name the clone | `/next` | Invokes `customize` — name first, then keep/strip. Writes `PRODUCT` to `.env.playbook`. |
| 5. Thin slice | agent | Ontology + spine + wave 0 (eval set) + one journey on `.env.local`. |
| 6. You look at it | you | Mandatory stop. |
| 7. `setup` | script | After they accept — [setup.sh](../.agents/skills/setup/setup.sh). GitHub, Neon, Vercel, Clerk, Linear. |
| Journey is the wrong story | `/next` | Reopen `shape` on the clip + journeys table, confirm, re-expand. No new skill. Same moments keep IDs. |

`status` is the glance. `setup` waits for the clip. `shape` does not rename packages. Loop: [playbook/fde-loop.md](playbook/fde-loop.md).

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
| `.agents/skills/` | Playbook + vendor skills. Source of truth. Vendored from [saas-playbook](https://github.com/hivinaynair/saas-playbook). Child jobs (`salvage-miner`, …) live here too — that is the path Pi and Claude Code scan. |
| `.cursor/skills/`, `.claude/skills/` | Symlinks to `.agents/skills/` so Cursor and Claude Code both see them. |
| `.cursor/agents/` | Cursor Task adapters (Grok 4.6). Point at `.agents/skills/<name>/SKILL.md`; do not duplicate the job. |
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

A new product shape records keep/strip. The `customize` skill applies it. Nothing else strips vendors.

## Playbook

Type `/next`. It reads `docs/product/state.yaml` and does every step that is not a human decision or a real-world fact. Skills live in [`.agents/skills/`](../.agents/skills/).

| Skill | Job |
|---|---|
| `next` | Router. Runs the current phase. One held item at a time. |
| `status` | Read-only glance. Runs `scripts/status.ts` + `check-drift.ts`. |
| `artifacts` | House rules for anything under `docs/product`, `docs/plans`, `docs/research`, `docs/journeys`. |
| `salvage` | Mine prior art. Incumbent first, then the market; facts ≠ menu parity. |
| `salvage-miner` | Child: one prior-art source. Facts, not structure. |
| `pile-reader` | Child: one inbox page → citable transcript. |
| `domain-researcher` | Child: one research thread. Parent files the note. |
| `spine-checker` | Child: validate `docs/journeys/*.yaml`. |
| `ui-gate-auditor` | Child: report gated-path edits. Does not fix. |
| `field-kit` | Homework only they can fill; photo-first; prune Closed; gap-pass before shape. |
| `shape` | Interview → design doc. Canvas is a view of that doc. |
| `ontology` | Domain entities before schema or spine. |
| `journeys` | Expand the design-doc journey table into an ID’d YAML spine. |
| `linear-sync` | Spine → Linear issues via `scripts/linear-sync.ts plan`, executed through the MCP. IDs come back; nothing else. |
| `design-system` | Layout primitives and semantic tokens before pages. |
| `plan` | One spine feature → short spec + slices. `/next` runs it after the spine. |
| `build` | Implements one slice. Tests cite step IDs. PR to `staging`. Host-agnostic. |
| `prototype` | Three variants of one component, mid-build. |
| `customize` | Names the clone (`scripts/customize.mjs`) and applies keep/strip. `/next` runs it after shape; first local clip next, not setup. |
| `setup` | Runs `setup.sh`. One Neon project, two databases. |
| `next-dev-loop` | Runtime verify after app edits (`/_next/mcp` + browser). |
| `before-and-after` | Vendor skill. Before/after screenshot pair for a PR. |

Phases, from [`next/SKILL.md`](../.agents/skills/next/SKILL.md): understand (salvage → research → field) → reframe (shape) → clip (ontology + journeys + local slice) → factory (setup, Linear, structure, waves). Setup is **not** on the path to the clip. `prototype` is not a phase. A wrong product story reopens `shape` on the journeys table, then `journeys` — still `/next`, no new skill.

Build runs in **waves**. Wave 0 is schema plus deterministic seed data; feature waves
follow, at most five agents at once, one per feature folder, and anything touching shared
surface runs alone. The first slice is the one mandatory stop — they look at it before the
rest is unleashed. `build` carries the isolate / hoist / prove / ship rules; there is no
separate skill for them.

No `docs/product/state.yaml` means no engagement. Boilerplate may be edited. This repo is in that state.

## Harness

| Piece | Path | Does |
|---|---|---|
| UI gate | [`.cursor/hooks/playbook.ts`](../.cursor/hooks/playbook.ts) `gate` | Denies Write/StrReplace/Delete under `apps/*/src/app` and `apps/*/src/features` until `shape` is `done` (or `ui_writes: allow`). Fail-closed. Missing state file = boilerplate, allowed. |
| Branch gate | same file, `branch` | `beforeShellExecution`. Denies `git push` to `main`, `gh pr create --base main`, and `--force` without `--force-with-lease`. Releasing is the user's move. |
| Session digest | same file, `session` | Runs `scripts/status.ts` and injects it. Cloud chats do not run `sessionStart`; the playbook rule still applies. |
| `salvage-miner` | [`.agents/skills/salvage-miner/SKILL.md`](../.agents/skills/salvage-miner/SKILL.md) | One prior-art source. Facts, not structure. |
| `pile-reader` | [`.agents/skills/pile-reader/SKILL.md`](../.agents/skills/pile-reader/SKILL.md) | One inbox page → citable transcript. Verbatim, untranslated. |
| `domain-researcher` | [`.agents/skills/domain-researcher/SKILL.md`](../.agents/skills/domain-researcher/SKILL.md) | One research thread. Parent files the note. |
| `spine-checker` | [`.agents/skills/spine-checker/SKILL.md`](../.agents/skills/spine-checker/SKILL.md) | Validates `docs/journeys/*.yaml`. |
| `ui-gate-auditor` | [`.agents/skills/ui-gate-auditor/SKILL.md`](../.agents/skills/ui-gate-auditor/SKILL.md) | Reports gated-path edits. Does not fix. |

These are skills, so Pi and Claude Code list them. How to start a sibling: `next` skill, **Start a child**. On Cursor, adapters in `.cursor/agents/` pin Grok 4.6; do not send playbook work to Gemini.

Rules: [`.cursor/rules/playbook.mdc`](../.cursor/rules/playbook.mdc) (always), `next-features` (feature folders + ontology names), `db` (wave 0, deterministic seed), `shadcn`, `testing`, `next-dev-loop`.

## Checks

Local, on commit ([`lefthook.yml`](../lefthook.yml)): Biome, boundaries, affected typechecks.

Deterministic where it can be: `scripts/status.ts` renders the digest, `check-drift.ts`
reports contradictions across artifacts, `linear-sync.ts` decides what Linear should say,
`customize.mjs` renames the clone, `journey.ts` validates and renders the spine. Skills
carry judgement; scripts carry anything that should come out the same every time.

Declared merge bar ([`AGENTS.md`](../AGENTS.md)):

```sh
bun run check-types && bun run check-boundaries && bun run check-tokens && bun run check-journeys && bun test
```

CI: [`.github/workflows/check.yml`](../.github/workflows/check.yml) on PRs and on `staging`/`main`. [`.github/workflows/migrate.yml`](../.github/workflows/migrate.yml) applies Drizzle on push to those branches. No journal yet = skip.

## Still open

| Gap | Why it can wait |
|---|---|
| Starter leftovers | “Create Next App” copy. `customize` question 1 and 7 delete it on the first real clone. |
| Billing | Not in the tree. Extend `customize` when a product asks. |
| `check-evidence` | PR bodies name step IDs by convention; no script enforces it yet. Add one if a false "done" ever lands. |
| Clerk orgs | Setup can flip the flag. No org UI until a product is B2B. |
| Build-skill names | Closed. `plan` and `build` — not `game-plan` / `lets-cook`. No verbose ticket writer. |
