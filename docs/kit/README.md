# Kit recipe

You do not need a second GitHub template for Next, Clerk, Neon, shadcn, or Eve.
This folder is the stack. Edit [recipe.yaml](recipe.yaml) when it should change.
Compose downloads **latest within the pinned majors** and then applies
[overlays.md](overlays.md).

A site clone after U5:

```sh
bun scripts/compose.mjs --add web --add db          # plan
# empty-path CLIs from the plan, then:
bun scripts/compose.mjs --add web --add db --apply  # overlays + env.ts
# then `commands (after --apply)` — bun add --cwd packages/db / apps/web
```

`--apply` refuses while this repo is still named `vipernxt`. Run the printed
empty-path CLIs first, then `--apply` to copy `overlays/` and write
`composed.yaml`, then the `commands (after --apply)` (`bun add --cwd …`).
`--without auth` drops Clerk from `apps/web/src/env.ts`.
The lockfile belongs on the site, not here. This kit does not ship a Next app.

| Want | Do |
|---|---|
| Latest Next / shadcn / Eve | Leave `command:` as `@latest`; bump `majors:` when you accept a breaking line |
| Clerk, Neon, Workflows | Surfaces + facets in the recipe; `--without auth` / `--without jobs` to drop them |
| Feature folders, `@/env`, UI gate | Overlays. CLIs will not do this. |
| EU / Asia | `NEON_REGION` at setup (`aws-eu-central-1`, `aws-ap-southeast-1`, …). Not a template. |
| Env vars | `setup.sh` writes `.env.playbook` and `.env.local`. Schema stays `apps/web/src/env.ts`. |
| Agents | `--add agent` → `bunx eve@latest init apps/agent`. Only if U5 named judgment steps. |

Do not free-hand `create-next-app` in chat. The script is the plan so two clones
in the same week get the same layout even if package patch versions differ.
