# Boilerplate hardening evidence — 2026-09-14

This change addresses the review follow-up: preserve outside-participant validation, make `/next` own progression, remove false completion signals, generate database CI only when selected, rename stack scaffolding, reduce repeated skill instructions, and design unattended execution.

## Changed behavior

- A named person other than the builder remains required for a real product. A physical site is optional; FDE research depth follows the actual workflow and deployment responsibility. Explicit simulation never becomes customer evidence.
- `/next` owns state transitions and pauses. Phase skills return results; accepted decisions are not asked again. Ontology and design-system structure precede implementation. Drift checks reject missing completion artifacts, unverified scaffold records, and slice acceptance without its decision/evidence.
- `scaffold` is the sole stack command. No compatibility alias remains. It supports a read-only plan, automated `--run`, and manual `--apply` followed by `--verify`. Selection is additive, custom environment definitions are protected, and completion is verification-dependent.
- The bare kit has no active migration workflow. Selecting `db` copies the Drizzle-ready template. Migration execution prefers the direct URL and rejects missing credentials in CI/production instead of silently migrating local storage.
- Importing scaffold helpers no longer exits the test runner. Broken eval imports and malformed exports fail discovery; build requires nonempty eval cases. Synthetic cases are no longer described as real in the score.
- Turbo receives the selected vendors' environment variables. Next scaffolding uses a pinned CLI with explicit no-linter, skip-install and disable-git choices, and a minimal starter using the shared semantic tokens.

## Validation

All 140 tests also pass inside the generated product clone; scaffold tests use isolated selections rather than inheriting product state. The kit's merge-bar commands pass: types, boundaries, tokens, journey IDs and **140 tests across 17 files**. Biome, shell syntax and diff whitespace checks pass. Empty-kit checks are intentionally distinguished from product validation.

A fresh disposable Git clone was renamed with a custom package scope, then `bun run scaffold -- --add web --add db --run` completed without manual correction. Actual web/UI/DB type checks and boundary/token checks passed. The final fresh clone passed a production build. An earlier smoke clone also rendered the starter in a browser. Drizzle generated its current directory-based migration format, and migration replay succeeded twice on local PGlite.

Independent read-only workflow scenarios checked founder-only intake, accepted-clip/no-supervisor continuation, and unverified-scaffold resume. All 22 skill frontmatters and local Markdown references passed a Bun-based validator. The bundled Python validator could not run because PyYAML was absent; this was not counted as a pass.

## Size and remaining limits

The 22 skill entrypoints fell from **20,898 to 6,492 words**, plus **396 words** in the shared contract: **67% less combined instruction text**. `/next` fell from 3,571 to 892 words. This measures words, not paid tokens, cost, or equivalent agent performance.

[Factory design and sources](factory.md) specifies a persistent supervisor, isolated workers, bounded retries/budgets, independent verification and serial staging integration. That runtime has not been implemented or proven by this change. Hosted provisioning, remote migration, vendor account flows and deployed product acceptance were not exercised. The Eve surface was not included in the scaffold smoke test. Those limits prevent a claim that the next arbitrary idea will build flawlessly unattended.
