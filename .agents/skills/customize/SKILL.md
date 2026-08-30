---
name: customize
description: >-
  Names this clone and applies the keep/strip answers — product name, package
  scope, apps, Clerk, Workflows, metadata, database. Use when starting a new
  repo from the boilerplate, before setup.sh, or when the root package is still
  vipernxt.
---

# customize

Rename and strip this clone. One question at a time. Apply only what they
answered. Do not invent a product or a UI kit.

`setup.sh` provisions infra under the name you write here. Run this **before**
setup. Shape may have already recorded keep/strip in the design doc — honour
those answers; do not re-ask them.

## Hard rules

- **Bun only.** `bun`, `bunx`, `bun test`. No Vitest, ESLint, or another package manager.
- **Feature-folder boundaries stay.** `app` / `src/proxy.ts` / `features` / `shared`.
- **One question per message.** Wait. Then apply that answer. Then the next.
- **Write the name first.** Question 1 writes `PRODUCT` to `.env.playbook` so
  setup cannot provision under `vipernxt`.
- **Do not start setup.sh from this skill.** Point at it when you stop.
- After edits: `bun install`, `bun run check-types`, `bun run check-boundaries`.

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
Playwright `webDir`, filters, and docs.

**4. Extra Next.js apps now?**

e.g. `marketing`, `admin`. Scaffold the same `src/app` + `src/features` +
`src/shared` layout, or skip.

**5. Auth**

Keep Clerk, strip it, or keep it and enable organizations (B2B)?

Stripping must remove `@clerk/nextjs`, `src/proxy.ts`, `ClerkProvider`,
`features/auth`, and env examples. Enabling orgs is a Clerk flag — do not
invent org UI.

**6. Vercel Workflows**

Keep (`workflow` + `withWorkflow` in `next.config`)? Remove the package and
wrapper if not.

**7. Default site metadata**

Title, description, `lang` on `<html>`.

**8. Database**

Keep Drizzle + Neon (`@repo/db` or the new scope), or strip it?

Billing is not in the tree. Do not add it.

## After the last answer

Read the summary back: name, scope, what was kept, what was stripped.

Then stop. Next is [setup](../setup/SKILL.md) — `./.agents/skills/setup/setup.sh`
— which reads `PRODUCT` from `.env.playbook`.
