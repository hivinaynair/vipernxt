---
name: customize
description: >-
  Names this clone and applies the keep/strip answers — product name, package
  scope, apps, Clerk, Workflows, metadata, database. Invoked by /next after the
  design doc is approved and before setup, or when the user asks to customize,
  or the root package is still vipernxt.
---

# customize

Rename and strip this clone. One question at a time. Apply only what they
answered. Do not invent a product or a UI kit.

`/next` runs this after `shape` is done. They should not have to type
`/customize`. `setup.sh` provisions under the name you write here — always
before setup. Shape may have already recorded keep/strip in the design doc —
honour those answers; do not re-ask them.

When the last question is applied, set `clone.customized: done` in
`docs/product/state.yaml` if that file exists.

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

**9. Bug board**

Which reviewer looks at the PRs the factory opens — Cursor Bugbot, Codex, Greptile, or
none? Write it to `.env.playbook` as `REVIEW_PROVIDER=<name|none>`.

`build` does not care which one. It needs to know only whether a reviewer may push
commits to a branch, because auto-merge must then require green **after** that push.

Billing is not in the tree. Do not add it.

## After the last answer

Read the summary back: name, scope, what was kept, what was stripped.

Then stop. Next is [setup](../setup/SKILL.md) — `./.agents/skills/setup/setup.sh`
— which reads `PRODUCT` from `.env.playbook`.
