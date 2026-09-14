# Overlays

Official CLIs (`create-next-app`, `shadcn init`, `eve init`, `neonctl`) do not
encode the opinions that make a clone of this kit. Scaffold runs the CLI, then
applies these. A clone that skipped them is not this kit.

| Id | After | What it enforces |
|---|---|---|
| `bun-only` | any | `only-allow bun`. No npm/pnpm/yarn, Vitest, or ESLint. |
| `feature-folders` | web | `apps/web/src` is `app` / `features` / `shared`. Features do not import each other. |
| `ui-in-packages` | ui | shadcn lives in `packages/ui`. Apps import `@repo/ui`. Never `components.json` under `apps/`. |
| `env-module` | web | Import `env` from `@/env`. Never `process.env` in app code. |
| `check-boundaries` | web | `tooling/dependency-cruiser` + `bun run check-boundaries`. |
| `ui-gate` | web | Hook denies `apps/*/src/app` and `src/features` until `shape` is `done`. |
| `analytics` | web | PostHog (`instrumentation-client`, `getPostHogServer`, `global-error`). Keys optional. `--without analytics` skips it. |
| `email` | web | `getResend()` in `src/shared/email.ts`. No-ops without `RESEND_API_KEY`. |
| `files` | web | `putBlob()` in `src/shared/blob.ts`, private. No-ops without `BLOB_READ_WRITE_TOKEN`. |
| `server-only-db` | db | `@repo/db` is server-only. Schema is empty until wave 0. |
| `judgment-gate` | agent | Eve proposes. A human posts. Do not put Eve and Workflows on the same step. |

`bun run scaffold -- --add web --run` executes the recipe, then copies overlays,
installs dependencies and verifies the result. For manual execution, run the
printed CLIs into empty paths, use `--apply`, install dependencies, then `--verify`.
UI is created by its overlay; do not run `shadcn init`. Initial `--without`
selections omit vendor keys and corresponding overlays. Product-owned files are
preserved; generated env changes are checked before writing.

Do not let the agent invent a tree that "looks like" them. No shadcn components
live here — `bun run ui:add` after scaffold.

Regions (EU / Asia) are **setup flags**, not overlays. See `setup.neon.regions`
in [recipe.yaml](recipe.yaml).
