# Overlays

Official CLIs (`create-next-app`, `shadcn init`, `eve init`, `neonctl`) do not
encode the opinions that make a clone of this kit. Compose runs the CLI, then
applies these. A clone that skipped them is not this kit.

| Id | After | What it enforces |
|---|---|---|
| `bun-only` | any | `only-allow bun`. No npm/pnpm/yarn, Vitest, or ESLint. |
| `feature-folders` | web | `apps/web/src` is `app` / `features` / `shared`. Features do not import each other. |
| `ui-in-packages` | ui | shadcn lives in `packages/ui`. Apps import `@repo/ui`. Never `components.json` under `apps/`. |
| `env-module` | web | Import `env` from `@/env`. Never `process.env` in app code. |
| `check-boundaries` | web | `tooling/dependency-cruiser` + `bun run check-boundaries`. |
| `ui-gate` | web | Hook denies `apps/*/src/app` and `src/features` until `shape` is `done`. |
| `server-only-db` | db | `@repo/db` is server-only. Schema is empty until wave 0. |

Copy these from this repo after the CLI returns. Do not let the agent invent a
tree that "looks like" them.

Regions (EU / Asia) are **setup flags**, not overlays. See `setup.neon.regions`
in [recipe.yaml](recipe.yaml).
