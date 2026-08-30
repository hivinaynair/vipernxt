# web

Next.js App Router app for this ViperNxt clone. Commands, env, and layout live
in the repo [README](../../README.md). Map of the monorepo and playbook:
[docs/map.md](../../docs/map.md).

```sh
bun run dev --filter=web
```

Routes in `src/app`. Domains in `src/features/*`. App-local code in `src/shared`.
Add shadcn components from the repo root: `bun run ui:add -- <component>`.
