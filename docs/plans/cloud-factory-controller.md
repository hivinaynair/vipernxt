# Keep the controller optional; test whether it reduces supervision

The core product is the local requirements-to-build playbook and its versioned Git artifacts. The Bun controller is an optional execution service for approved batches. V1 uses Linear, Cursor Cloud and Fly; other users should be able to use the playbook with their own harness and tracker without deploying this service.

## Boundaries

| Component | Responsibility |
|---|---|
| Local `/next` | Discovery, customer evidence, design, scaffold, first-slice acceptance, approved scope |
| Git | Versioned requirements, journey IDs, acceptance checks, dependencies and allowed paths |
| Linear adapter | Commands, issue snapshots, drift detection and progress reporting |
| Controller | Durable scheduling, bounded attempts, recovery and integration gates |
| Cursor adapter | Launch, inspect, cancel and recover remote execution identities |
| Cursor verification run | Review the exact candidate and execute checks/browser scenarios |
| Fly | Host the foreground Bun service and persistent data |

Keep provider authentication and payloads inside adapters. Do not require Linear IDs in core product requirements. Do not add speculative providers or a plugin framework before a second implementation needs them. Native Cursor–Linear execution is a valid alternative, not an incomplete controller setup.

## Implemented v1

See [controller operations](../playbook/controller.md) and `scripts/controller/`. One owner, one workspace and one active batch; one Fly Machine with SQLite on a persistent volume. The controller uses a Linear OAuth app actor, signed webhook inbox, durable response outbox and exact commands. Registration pins approved Git scope and issue content; edits hold new dispatch and integration.

The controller owns Linear during its execution path. Workers receive pinned instructions. Product setup, build, tests and browser checks run in Cursor VMs; independent verification is another Cursor run. Its reports remain agent-reported evidence, not CI. The controller performs Git integration checks but does not execute product commands. Accepted work stops at In Review; no automatic staging merge or production deployment.

## Comparison before recommending adoption

Return Desk's `docs/experiments/execution-comparison.md` specifies one synthetic two-task batch, common starting tree and pinned acceptance checks. Compare genuine native Cursor–Linear execution with controller execution. Record human interventions/time, correctness, elapsed time, retries, duplicate dispatches, recovery and cost. Charge independent verification to the controller arm and report hosting/maintenance separately. Unknown cost stays unknown.

Force one controller restart during active work and verify reuse of persisted Cursor run IDs. A healthy idle restart does not establish this. Keep the controller optional unless it passes acceptance and materially reduces supervision. One batch supplies directional evidence, not statistical proof.

## Remaining release gates

Complete the comparison; verify active-run recovery and cancellation; test backup/restore with the old host fenced. Verify worker credentials cannot mutate Linear through inherited integrations. Document missed-webhook recovery rather than claiming polling that is not implemented. Defer multi-tenancy, parallel execution and additional providers.
