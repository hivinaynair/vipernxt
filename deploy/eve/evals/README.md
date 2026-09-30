# Free factory simulation

This opt-in runner exercises the **production `tick` engine and shared intake validator**. It uses a clean, already-scaffolded synthetic Claimline engagement with installed product dependencies. It reconstructs wave-0 route shells and implements two dependent approved behaviors with deterministic command workers. Every transition runs in a new process, reading the checkpoint and simulated provider ledger from disk.

```sh
bun deploy/eve/evals/offline.ts \
  --product /path/to/claimline \
  --output /tmp/new-factory-run \
  --scenario recovery
```

Use a new output directory for every run. `happy` checks normal delivery. `recovery` introduces a wrong queue link, a real TypeScript defect, malformed integrated/staging reviewer output and a lost deployment-dispatch response. Actual Chromium checks must detect the combined navigation defect; integration and CI repair must retain the approved scope, update the same draft PR, reverify the changed candidate, and complete against the exact local HTTPS candidate. Neither malformed review may buy another builder or reset its clock. A single staging dispatch must survive the lost response. Completion and counts are asserted; failures exit nonzero and preserve evidence.

The recovery scenario also exits the coordinator abruptly after a worker commits and after staging dispatch succeeds, before either result is accepted/checkpointed. A duplicate wake while the saved lease is live must leave the checkpoint byte-for-byte unchanged. The runner then advances a **test-only virtual clock** to lease expiry and starts a new coordinator process. Cached worker/workflow identities must reconcile with no repeated build or dispatch. This proves the engine's recovery protocol against the local provider substitute; it does not prove real provider consistency or real multi-host failover. The ordinary transition loop restarts the process at every boundary too.

Requirements: Bun 1.4+, Git, OpenSSL, the product lockfile/cache and Chromium (`CHROMIUM_PATH`, default `/usr/bin/chromium`). Ports 3180, 3190 and 3443 must be free. The product's frozen dependencies are installed into an isolated clone; its database is migrated and seeded locally. The source checkout is untouched, and the clone's remote is removed. Setup stops when a required command fails.

The evaluation's customer decisions and walkthrough are **synthetic**. Live intake is explicitly asserted to reject them; only this evaluation calls the shared validator with `allowSimulation`. GitHub/Cursor API responses and draft-PR/workflow records are deterministic local substitutes. Browser, Git commits, checks, database and process restarts are real local execution. The staging simulator uses Next development mode and an ephemeral certificate pinned specifically by Chromium; it is not a hosting deployment or production database. Credentials, paid inference, external publication, merges and hosted workflow dispatch are absent.

Evidence includes `summary.json`, hash-cited command outputs, `state.json`, the simulated `provider.json` ledger and the resulting product Git history. Keep failure directories. The ephemeral `key.pem` is generated test material; do not publish or reuse it. Parallel simulator runs would share ports and are unsupported.

Readiness rubric (set before successful reruns): one point each for (1) complete structural requirements trace and unresolved-policy holds, (2) immutable scope/SHA/action approval, (3) actual persisted product/browser behavior, (4) restart/fencing/idempotency, (5) independent strict review with separate retry budgets, (6) combined-product and CI repair, (7) single authorized staging handoff and exact-site acceptance, (8) reproducible builds and bounded invocation duration, (9) adversarial failure/hold coverage, (10) a real hosted two-slice pilot with provider recovery and verified operational notification delivery. A passing simulation plus the repository checks can earn **9/10 offline workflow readiness**. Point 10 requires live evidence. Hosted reliability is scored separately; simulated provider records cannot earn that evidence or demonstrate model quality, billing limits, customer completeness, production auth or hosting durability.

[Hosted evidence](hosted.md) records the separately authorized paid-provider trials, preserved failures and current completion boundary. Offline replay results alone do not certify remote delivery.
