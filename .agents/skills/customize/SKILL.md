---
name: customize
description: >-
  Names this clone and scaffolds the stack from docs/kit/recipe.yaml — product
  name, package scope, surfaces (web / agent), Clerk, Neon, Workflows, PostHog,
  Resend, Blob. Invoked
  by /next after the design doc is approved, or when the user asks to customize,
  or the root package is still vipernxt. Setup waits until they accept the clip.
---

# Name and scaffold the clone

Input: accepted design and recipe selections. Follow [execution contract](../CONTRACT.md). This names/configures the local clone; `setup` provisions cloud resources after the slice review.

Read `docs/kit/recipe.yaml`. Reuse settled choices; ask one unresolved decision at a time. Record product/repo name, workspace scope (default @repo), app directory (default web), surfaces, facets, language/metadata, region and review provider. Do not repeat questions the design answers. No billing vendor unless the recipe includes it.

Run the rename script first:

```sh
bun scripts/customize.mjs --name <kebab> [--scope @acme] [--app dashboard]
bun scripts/customize.mjs --name <kebab> [--scope @acme] [--app dashboard] --apply
```

Inspect the dry-run file list. The script owns package/path renames and writes PRODUCT to `.env.playbook`. Do not hand-edit scattered package names.

Scaffold the approved surfaces:

```sh
bun scripts/scaffold.mjs --add web --add db --without jobs
bun scripts/scaffold.mjs --add web --add db --without jobs --run
```

The first command previews; `--run` creates missing CLI paths, writes overlays, installs dependencies and verifies. For manual execution, run the printed CLIs, `--apply`, printed dependency installs, then `--verify`. `--apply` alone never means done. Manifest: `docs/kit/scaffolded.yaml`; state: `clone.scaffolded`.

`--add` retains prior surfaces and excluded facets. `--without` selects exclusions initially; removal from an existing application needs an explicit change plan. Product-owned files are preserved; custom environment changes belong in `env.ts`, vendor definitions in `env.generated.ts`. DB selection generates its migration workflow; a no-DB project has none.

Script steps do not automatically require a web screen; pick surfaces from actual accepted interactions. Judgment does not automatically require Eve: select the smallest mechanism. Auth/jobs/analytics/email/files may be excluded when unnecessary. Database fallback allows the local clip before Neon setup; package installation is not proof of live vendor connectivity.

Return the selected stack, verification and remaining runtime work to `/next`. Do not stop to ask whether to continue already-authorized build, and do not invoke setup here.
