---
name: customize
description: Name the clone and scaffold only approved recipe surfaces and optional services.
---

# customize

Read [CONTRACT](../CONTRACT.md) and `docs/kit/recipe.yaml`. Inputs: approved design/selections. Reuse settled choices; resolve only unknown name/scope/app, surfaces/facets, metadata, region and review provider.

```sh
bun scripts/customize.mjs --name <kebab> [--scope @acme] [--app dashboard]
bun scripts/customize.mjs --name <kebab> [--scope @acme] [--app dashboard] --apply
bun scripts/scaffold.mjs --add web --add db --without jobs
bun scripts/scaffold.mjs --add web --add db --without jobs --run
```

Inspect previews. Scripts own renames and PRODUCT; `--run` executes CLIs, overlays, installs and verification. Manual execution requires all printed steps; `--apply` alone is incomplete. Record `docs/kit/scaffolded.yaml` and clone.scaffolded.

`--add` preserves prior selections; `--without` selects initial exclusions. Removing existing services needs a change plan. Preserve product-owned files; custom env belongs in env.ts, generated vendors in env.generated.ts. DB generates migration CI; no DB means none.

Choose the smallest accepted mechanism: headless work needs no web, judgment needs no automatic Eve selection, auth/jobs/analytics/email/files are optional. Local DB fallback supports the first slice before cloud provisioning. Return verification/runtime gaps to /next; setup follows slice acceptance.
