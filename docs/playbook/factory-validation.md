# Factory validation — 2026-09-14

The local serial supervisor is executable, with independent worker processes, a persistent ledger, a repository-wide controller lock, isolated worktrees, bounded retries/timeouts, cancellation, external verification and an integration branch. `/next` now routes an accepted scope into its manifest and launch commands. See [runtime usage](factory-runtime.md).

## Automated proof

The full repository suite passes: **159 tests across 18 files**, including 19 factory tests. Factory TypeScript checking, Biome, boundary/token/journey checks and skill link/frontmatter checks pass.

The factory regression suite exercises:

- Two dependent slices: B sees A's accepted commit; staging and the user's checkout remain unchanged.
- Required check failure: the failing job exhausts its attempts and blocks dependants.
- Repair: a fresh worktree receives the concrete prior failure and succeeds within the retry budget.
- Supervisor SIGKILL: restart observes the original worker rather than starting a duplicate attempt.
- Duplicate controller: SQLite locking prevents a second supervisor from scheduling work.
- Out-of-scope edits and changed specs: neither can be silently accepted.
- Missing browser verification and cyclic dependencies: rejected before dispatch. A browser command exiting zero without its candidate-bound receipt also fails.
- Delivery receipts: only the exact integrated commit can become delivered.
- Timeouts, cancellation and dead runners: partial work cannot become accepted.
- External integration changes: stale checks cannot overwrite another result.
- Crash after Git integration but before ledger save: restart reconciles the existing commit without duplicate integration.

These are real subprocess/Git worktree tests using deterministic synthetic workers. Synthetic delivery receipts validate the protocol, not a real staging deployment.

## Real provider proof

A separate disposable Git repository contained an explicitly synthetic accepted invoice-total calculator spec. The factory dispatched the actual Codex CLI to implement `total(values: number[]): number`, then ran independent checks for normal, empty and negative inputs. It accepted one commit on its integration branch and ended `completed-local`. The source checkout was unchanged.

The PATH CLI, version 0.147.0, initially rejected the configured `gpt-6-astra` model as requiring a newer CLI. Those failed runs accepted nothing. An explicit `worker.executable` using the installed app's 0.154.0-alpha.6.2 binary ran successfully, preserving the configured model. A separate read-only Codex reviewer also returned `approved: true` with no findings through the structured review adapter. The test did not install or change the user's global CLI configuration.

The successful worker reported 84,023 aggregate input tokens, including 74,496 cached input tokens, and 402 output tokens. These are provider-reported totals across the worker's turns, not the size of a single prompt or a dollar estimate. They demonstrate that caching/global CLI context still matters; a short task contract does not eliminate model/tool overhead. Review usage is separate; JSON usage events are now collected from all stage logs when available.

## Limits

This proves local execution and restart behavior, not hosted product delivery. A product still needs authentic requirements, runnable acceptance/browser commands, a compatible authenticated worker and an authorized delivery adapter. The core never merges staging or production itself. It cannot certify that an arbitrary configured command actually performs its claimed browser checks; acceptance commands and their sources must be reviewed and pinned.

Runs are serial and single-host. Machine shutdown requires an explicit resume. There is no Linear projection, cross-host scheduler, automatic provisioning, or monetary hard cap in this version. Job/run time limits and attempt caps bound execution; provider billing controls must enforce actual spending limits. The runtime remains experimental until used against a real product's deployed acceptance scenarios.


## Cursor Cloud adapter (2026-09-14)

The Cursor adapter targets API v1, persists client-supplied agent IDs before dispatch, resumes the same remote run after local interruption, and blocks uncertain cancellation. Returned code is fetched into the isolated worktree and passes the same acceptance gates. A separate Cursor review sees the candidate commit. First-slice mode ends at `awaiting-review`.

The factory/hooks-focused suite passes 35 tests, including 11 mocked Cursor contract cases. The full kit suite passes 175 tests. These cover lost launch responses, wrong repository results, terminal failures, confirmed/unconfirmed cancellation, immutable inputs, credential-safe errors and cleanup after local failure. Existing subprocess tests exercise integration, retries and supervisor recovery. Mocked HTTP tests do not establish live cloud reliability.

A private Return Desk repository was prepared for a live follow-up UI slice with pinned Playwright checks. During preflight, a fresh Git repository exposed a hook assumption that HEAD already existed; the hook now runs all type checks for the first commit. GitHub's HTTPS OAuth credential lacked workflow scope; the same authorized repository was published using its working SSH key. Cursor API authentication and visibility of the new repository returned HTTP 200. The first real Cursor worker finished in 756 seconds, producing commit `dc1cba1` on `cursor/return-desk-search-filters-deb0` in the private `hivinaynair/return-desk-cloud-test` repository. The controller independently passed both pinned Playwright scenarios against candidate tree `60233cd698797e0528b003392f6842b71b5f88db`. Killing and restarting the local supervisor retained one attempt and the same agent/run IDs.

The reviewer launch exposed a live API edge case: a new review commit SHA was rejected with HTTP 400; its dedicated branch was accepted. Reconciliation reused the same agent ID, and explicit `resume` preserved the builder result and original prompt. Both implementation and review now launch through dedicated input refs. Cursor's environment also had managed Git hooks and an incomplete Bun executable path; the kit now keeps managed hooks and uses `bun x` for its installer guard. The separate Cursor reviewer finished in 248 seconds with `approved: true` and no findings. Controller checks passed: type checks, four return-domain tests, both Playwright scenarios, boundaries, semantic tokens, journey citations and production build. The supervisor accepted one implementation attempt and integrated commit `9c3e3db56630cccc03a648e8feed0f3c4199b68e`, ending at `awaiting-review`. Its verified branch was published to the disposable repository; no staging merge or deployment was performed. A local preview runs at `http://localhost:3123/` while its dev server is alive.

This proves one cloud-built follow-up slice and a recovered independent review, not an entire product built from an empty scaffold. Token usage/cost was not verified from the run responses. The kit still needs an always-on controller host for laptop-off scheduling, and the available Linear connection returned a reauthentication error. The manifest queue remains authoritative.
