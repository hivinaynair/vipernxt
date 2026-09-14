# Playbook execution contract

`/next` owns progression, state transitions and user pauses. Phase skills do their one job and return control; they never demand a second “go” for already authorized work. A standalone skill ends when its requested artifact is ready. User instructions take precedence.

## State and evidence

`docs/product/state.yaml` owns progress, artifact references and decisions. Documents own their content; never reconstruct progress from prose. Read the current state and only the current phase inputs. Record each answer verbatim, with a stable ID, owner and date. Do not re-ask settled decisions. A done phase requires its artifact. Report contradictions before repairing them; do not silently manufacture approval.

A real engagement requires at least one named person other than the builder who independently has the problem, including for self-use products. `engagement.site` identifies that person and their context; a physical customer site is not required. No person: category scan plus one gather, no product build. An explicitly authorized simulation labels every invented fact and approval; it never counts as customer validation.

## Questions and autonomy

Ask one highest-impact unresolved question at a time, with a recommendation. Only hold work for missing real-world facts, a material unsettled product choice, expanded scope, a destructive/irreversible action or spending outside existing authorization. Continue independent work. Repeated corrections on one theme mean revisit the model, not add another patch.

Held items use `kind: gather | decide`, `who: fde | site`, `what`, `done_when`, `status`; deferrals need `until`. Scope-expanding decisions state the original ask, added commitment, smaller alternative, accept/decline costs and recommendation. In conversation say “waiting on you/the customer”, not pipeline jargon.

## Gates and return contract

No product UI before confirmed U5 and approved design (`shape: done`), unless the explicit `ui_writes` override applies. Never disguise assumptions as confirmations. Review the first working slice before full provisioning/remaining factory work. A dedicated product repository may be provisioned earlier for explicitly selected cloud implementation. The first-slice review may be simulated only when the user already authorized simulation of that review.

Each skill returns a compact result: `completed | needs-input | blocked`, artifact paths, evidence, unresolved items, and next action. `/next` records it and continues. Do not repeat the result in multiple reports. Missing optional tools are disclosed; missing required acceptance evidence prevents completion.

Use `artifacts` for product/research documents. Follow AGENTS.md for stack, boundaries and branch/worktree rules. Commit product artifacts under the repo's existing policy; do not commit raw customer material or secrets. External publishing, merging and spending follow the engagement's existing authorization, not a worker's interpretation of a ticket.
