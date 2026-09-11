---
name: customize
description: >-
  Names this clone and composes the stack from docs/kit/recipe.yaml — product
  name, package scope, surfaces (web / agent), Clerk, Neon, Workflows. Invoked
  by /next after the design doc is approved, or when the user asks to customize,
  or the root package is still vipernxt. Setup waits until they accept the clip.
---

# customize

Name the clone, then compose from the recipe. One question at a time. Apply only
what they answered. Do not invent a product or a UI kit.

`/next` runs this after `shape` is `done`. They should not have to type
`/customize`. Honour surfaces already recorded in the design doc; ask only
what the doc left open.

When the last question is applied, set `clone.customized: done` in
`docs/product/state.yaml` if that file exists (`customize.mjs --apply` does
this). Do not run `setup.sh` from here while `clone.setup` is `deferred` —
`/next` builds the first local clip next.

## Hard rules

- **Bun only.** `bun`, `bunx`, `bun test`. No Vitest, ESLint, or another package manager.
- **Feature-folder boundaries stay.** `app` / `src/proxy.ts` / `features` / `shared`.
- **Compose from the recipe.** Read [docs/kit/recipe.yaml](../../../docs/kit/recipe.yaml).
  Run `bun scripts/compose.mjs --add …` and follow that plan. Do not free-hand
  `create-next-app` or invent a tree.
- **One question per message.** Wait. Then apply that answer. Then the next.
- **Write the name first.** Question 1 writes `PRODUCT` to `.env.playbook` so
  setup cannot provision under `vipernxt`.
- **Do not start setup.sh from this skill.** `/next` runs the local clip next.
- **Renames go through the script, not by hand** — see below.
- After edits: `bun install`, `bun run check-types`, `bun run check-boundaries`.

## Renaming is a script

Questions 1–3 are answered by interview and applied by

```sh
node scripts/customize.mjs --name <kebab> [--scope @acme] [--app <dir>]   # dry run
node scripts/customize.mjs --name <kebab> [--scope @acme] [--app <dir>] --apply
```

A name lives in the root `package.json`, every workspace `package.json`, every
dependency entry, tsconfig `extends`, turbo filters, the Playwright `webDir` and
the docs. By hand you miss one and it surfaces later as a confusing resolution
error. Run the dry run, read the file list, then apply.

Composing surfaces is **`scripts/compose.mjs`**, not this rename script.

```sh
bun scripts/compose.mjs --add web --add db
bun scripts/compose.mjs --add agent
bun scripts/compose.mjs --add web --without auth --without jobs
```

`--apply` writes `docs/kit/composed.yaml` and copies `docs/kit/overlays/` onto
the clone. It refuses while the root package is still `vipernxt`. **Run the
printed CLIs into empty paths first** (`create-next-app` / `shadcn init` /
`eve init` refuse a non-empty folder), then `--apply`. `--without auth`
rewrites `apps/web/src/env.ts` so Clerk is not required. It sets
`clone.composed: done`. This kit does not ship Next, shadcn, or Neon — do not
copy a fat tree in to strip it.

## Questions

Ask in this order. Skip a question only when the design doc or a previous
answer already settled it — say so in one clause, then ask the next.

**1. Product name**

Human title and repo/package name (npm-safe kebab, e.g. `acme`).

Today the root package is `vipernxt`. Rename `package.json`, README title, and
any user-facing “ViperNxt” / “Create Next App” copy.

On the answer: `PRODUCT=<kebab>` into `.env.playbook` (create the file). Do not
commit `.env.playbook`.

**2. Workspace scope**

Instead of `@repo` (e.g. `@acme`)? Update every `package.json` `name` /
dependency and tsconfig `extends`. Keep `@repo` if they say so.

**3. Rename `apps/web`?**

And matching `e2e/web`. Keep `web` if unsure. Update workspace names,
Playwright `webDir`, filters, and docs. Skip if surfaces do not include `web`.

**4. Surfaces**

From the design doc / U5: `web`, `agent`, or both. Record `clip.kind`
(`replace` | `wrap`) and `surfaces:` on `state.yaml`. Then run compose for
those surfaces.

- Script steps → `web` (and `db` unless they said no persistence).
- Judgment steps → `agent` (`bunx eve@latest init`). Do not install Eve
  because it is fashionable.
- Human-only → neither.

**4b. Extra apps**

e.g. `marketing`, `admin`. Scaffold the same `src/app` + `src/features` +
`src/shared` layout, or skip. Default skip.

**5. Auth** (if `web`)

Clerk as in the recipe, skip it, or keep it and enable organizations (B2B)?

Skipping: `compose --without auth`. While the fat tree is still present, also
remove `@clerk/nextjs`, `src/proxy.ts`, `ClerkProvider`, `features/auth`, and
env examples. Enabling orgs is a Clerk flag — do not invent org UI.

**6. Vercel Workflows** (if `web`)

Keep, or `--without jobs`? Remove the package and `withWorkflow` if not.

**7. Default site metadata** (if `web`)

Title, description, `lang` on `<html>`.

**8. Database** (if `web`)

Neon + Drizzle as in the recipe, or skip (`surfaces` without `db`)?

**9. Region** (record only)

Neon region for setup: `aws-us-east-1` (default), `aws-eu-central-1`,
`aws-ap-southeast-1`, or another value from the recipe. Write `NEON_REGION`
to `.env.playbook`. Optional `VERCEL_REGION`. Do not create the project here.

**10. Bug board**

Which reviewer looks at the PRs the factory opens — Cursor Bugbot, Codex, Greptile, or
none? Write it to `.env.playbook` as `REVIEW_PROVIDER=<name|none>`.

`build` does not care which one. It needs to know only whether a reviewer may push
commits to a branch, because auto-merge must then require green **after** that push.

Billing is not in the tree. Do not add it.

## After the last answer

Read the summary back: name, scope, surfaces, what compose will install, region.

Then stop. `/next` continues the clip on `.env.local` (ontology, spine, wave 0,
first slice). Run [setup](../setup/SKILL.md) only after they accept that slice
(`clone.setup` flips to `pending`), or if they ask for a hosted preview.
