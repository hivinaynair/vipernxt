# Stack scaffolding

[recipe.yaml](recipe.yaml) defines the supported surfaces and vendors; [overlays.md](overlays.md) describes the kit conventions. Name the product clone and approve its design before scaffolding.

```sh
bun run scaffold -- --add web --add db          # read-only plan
bun run scaffold -- --add web --add db --run    # CLIs, overlays, install, checks
```

For manual execution, run the printed empty-path CLIs, repeat the selection with `--apply`, install the printed dependencies, then run `bun run scaffold -- --verify`. `--apply` records `status: configured`; only successful verification sets `clone.scaffolded: done`. Runtime behavior and deployment require separate evidence.

Selection is additive: adding `db` later preserves `web`, `ui`, and previous exclusions. Use `--without auth,jobs,analytics,email,files` at initial selection to omit unwanted facets. Removing an installed facet requires an explicit code/data removal plan. Unknown selections fail.

The Next CLI is pinned and disables its linter and initial install explicitly. The script validates Next/React majors; the generated product lockfile records resolved dependencies. Eve and vendor dependencies still resolve from their recipe specifications, so this is not a fully frozen dependency snapshot.

`src/env.generated.ts` contains vendor keys; `src/env.ts` is the product extension point. Edited generated files fail preflight. Custom entrypoints are preserved; adding new keys to one needs explicit integration. Other edited overlay files are kept and reported.

Selecting `db` generates `.github/workflows/migrate.yml` from [the template](workflows/migrate.yml), ready for Drizzle migrations on staging/main. The bare kit has no active migration workflow. Setup supplies each environment's `DATABASE_URL_UNPOOLED`; CI never falls back to a local database.

Regions are setup flags. Provisioning follows acceptance of the first working slice. Installing a vendor dependency does not prove authentication, background jobs, analytics or deployment works; the relevant slice must wire and test its behavior.
