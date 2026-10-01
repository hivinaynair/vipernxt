# Bounded hosted failure campaign — 1 October 2026

This campaign exercises real GitHub-triggered Eve workflows, Cursor workers,
Jev inference and staging delivery in the disposable private
`hivinaynair/return-desk-cloud-test` repository. It keeps the original synthetic
J1.S1 requirements, independent reviewers and acceptance checks. Controlled
fault injection is not evidence of spontaneous provider outages or a measured
reliability rate. Production main is unchanged.

This report preserves the campaign's deployment evidence. Subsequent active
runtime and Slack owner-notification checks are recorded in [slack.md](slack.md).

## Isolation and evidence

Runtime source `ac205ad00a015e0e9b4a5ae831af94a9a1b3df7a` deployed READY as
`vipernxt-factory-qqc32g7km-vinaynair-projects.vercel.app`
(`dpl_FqG4gi7qR8HjgMnhHRwbMzT7xWHx`). The opt-in campaign setting is
`live-failure-20261001`. Both callback endpoints reject unsigned requests with
401. Production-target build, strict Eve types, required root checks and
[GitHub CI](https://github.com/hivinaynair/vipernxt/actions/runs/36828702508/job/110260117848)
pass; the root suite has **439 tests, zero failures, 47 files**, including
256 Eve tests. Nine fault-control tests cover opt-in boundaries, rejected
manifests, checkpoint ordering, bounded consumption and credential isolation.

Only a pinned simulation manifest in the configured disposable repository and
staging branch can enable faults. Registration requires the exact deployment
campaign value. The existing limits remain two jobs, two builder attempts per
job, at most 20 minutes per station and two hours per batch. Fault consumption
is checkpointed before its effect and bounded across replay. There is no public
fault-control endpoint. Invalid test tokens perform real diagnostic requests;
the production credentials are never rotated or printed.

[Setup PR #28](https://github.com/hivinaynair/return-desk-cloud-test/pull/28)
adds only simulation manifests, passed CI and merged disposable staging at
`e24e332a4c7525926e500ab2345d9653af1fb1dc`. Requirement, evaluator and approval
hashes are unchanged. The original completed pilot remains available at its
[immutable checkpoint](https://github.com/hivinaynair/return-desk-cloud-test/blob/35b6318df922b747fd38e3e3976c437812d81cd2/factory-state.json).

## Trial results

| Trial | Injected effect | Observed outcome |
|---|---|---|
| [Authentication hold #29](https://github.com/hivinaynair/return-desk-cloud-test/issues/29) | One Cursor GET with an invalid test token | Actual HTTP 401; deterministic permission hold; no worker launch. Authenticated GET of the reserved agent returned 404. [Owner receipt](https://github.com/hivinaynair/return-desk-cloud-test/issues/29#issuecomment-5926590062) delivered `ask_owner` and `cc @hivinaynair`. |
| [Lost launch #30](https://github.com/hivinaynair/return-desk-cloud-test/issues/30) | Discard one successful launch response, then discard three actual read responses as synthetic 503s | Native bounded retries exhausted. Jev diagnosed verified original agent/run as RUNNING, selected `retry_read` with probability 0.94 and automatically resumed. Same identity, attempt and original clock; no owner notification. **Completed unattended**, with two first-attempt builders, all four independent reviews, exact-SHA CI, one automatic staging request and deployed acceptance. |
| [Replay and dispatch #32](https://github.com/hivinaynair/return-desk-cloud-test/issues/32) | Durable step failure after reservation; discard one actual staging-dispatch response | Workflow trace confirms the scheduled 10-second retry. Original identity, stage clock and first builder attempt survived. One actual staging reply was discarded; Eve reconciled the existing request/run without redispatch. **Completed unattended**, including all four independent reviews, exact-SHA CI, automatic staging and actual-site acceptance. |
| [Jev unavailable #34](https://github.com/hivinaynair/return-desk-cloud-test/issues/34) | Withhold a real worker-read reply; fail bounded real evaluator requests with an invalid test token | Both bounded evaluator requests failed; actual Gateway HTTP 401 recorded. Diagnosis became `unavailable`, owner received `ask_owner`, and no independent reviewer, PR or deployment was launched. Original builder confirmed FINISHED before the next trial. |
| [Deadline hold #35](https://github.com/hivinaynair/return-desk-cloud-test/issues/35) | Delay committed reservation 75 seconds beyond its original 60-second station budget | Scheduled retry crossed the unchanged deadline. Engine held before launch; deterministic triage returned `stop` and notified the owner. Authenticated Cursor GET of the reserved identity returned 404. No run, reviewer, PR or staging dispatch. |
| [Scope hold #36](https://github.com/hivinaynair/return-desk-cloud-test/issues/36) | Remove only the trial's factory label during a reserved-step retry window | Label removed at 07:59:16.992 UTC before scheduled replay. Eve paused and notified the owner before launch. Original identity and clock retained; authenticated Cursor GET returned 404. No run, reviewer, PR or staging dispatch. |

Lost launch identity: agent `bc-94f8bc7e-be53-428a-a776-4dedc3e0571f`, run
`run-24b7d009-6d77-4727-af07-1dc93fcec937`, original station start
`1790838964675`. The engine did not receive the discarded launch run ID; its
diagnostic reads and subsequent reconciliation recovered it from Cursor.
The fault ledger records the test effect separately. Jev's advisory result does
not approve code; all ordinary candidate and review gates still apply.

Lost-launch final candidate `e013278f2a5bffa0acc977647095cb83803929a5` is
recorded at the [immutable completed checkpoint](https://github.com/hivinaynair/return-desk-cloud-test/blob/4bb6cec84a63ecab4bce3ff60f92e1ff7eda9cad/factory-state.json).
[Draft product PR #31](https://github.com/hivinaynair/return-desk-cloud-test/pull/31)
targets staging and remains unmerged. [Exact-candidate CI](https://github.com/hivinaynair/return-desk-cloud-test/actions/runs/36830536141/job/110265873879)
and [automatic staging run 36830650836](https://github.com/hivinaynair/return-desk-cloud-test/actions/runs/36830650836)
passed. Request `factory-49b7c683-8087-4b7f-9b6e-3df0f8c9fa4a` corresponds to
GitHub deployment `6778696052` / status `19101053416`. Vercel deployment
`dpl_DTeLWj8xquiPmZHY2kUAxdK9Rsgn` is READY with matching `factoryCandidate`.
The independent deployed reviewer passed all three live browser cases; a
separate direct Chromium run also passed three cases. Its initial attempts
failed before navigation because the workspace lacked the matching browser
binary; installing Chromium corrected the workspace and the actual rerun
passed. The failed setup attempts remain in the evidence and are not counted
as acceptance.

Replay workflow `wrun_41M3V65FQZ0GXTFNJQ7EZ5TE3M`, step
`step_01M3V65FQZ0GRGW4GS596FM1MD`, retained agent
`bc-f24e7870-b516-4328-9966-700e8e0abb54`, run
`run-157ea2be-b813-4c46-bf16-7bedd3ec01ae` and original stage start
`1790840103653`. This demonstrates a hosted durable step retry after committed
state; it does not demonstrate killing the host process during a provider call.

Replay/dispatch final candidate `b336b612b1062c97437beb51ef2fdb09d3a8218c` is
recorded at the [immutable completed checkpoint](https://github.com/hivinaynair/return-desk-cloud-test/blob/e17ad79da0654a092e2497e08e3eb72d8708eb22/factory-state.json).
[Draft product PR #33](https://github.com/hivinaynair/return-desk-cloud-test/pull/33)
targets staging and remains unmerged. [Exact-candidate CI](https://github.com/hivinaynair/return-desk-cloud-test/actions/runs/36832414103/job/110271824963)
and [automatic staging run 36832519954](https://github.com/hivinaynair/return-desk-cloud-test/actions/runs/36832519954)
passed. GitHub Actions lists exactly one run for request
`factory-1461b509-e64e-442c-ad5f-b89e2505c003` after the reply was discarded.
The engine verified deployment `6779013825` / status `19101785860`; Vercel
deployment `dpl_Aa7mZFs9ftFamyX8Ua1v1YamQbQ4` is READY with matching
`factoryCandidate`. Independent deployed review and a separate direct
Chromium run each passed all three live cases. Neither trial required a manual
resume, acceptance override, replacement builder, evaluator edit or deployment.

Jev outage [owner receipt](https://github.com/hivinaynair/return-desk-cloud-test/issues/34#issuecomment-5927241945)
and [immutable held checkpoint](https://github.com/hivinaynair/return-desk-cloud-test/blob/208628594258c362d22beea33548b35f9f9bc6e8/factory-state.json)
record `status: unavailable`, `recommendation: ask_owner`, `resumed: false` and
the consumed fault cap. Two actual evaluator failures followed the single
withheld Cursor read, for a ledger count of three. The test demonstrates
fail-closed behavior under diagnostic authentication failure; it is not an
availability measurement for Jev.

Deadline [owner receipt](https://github.com/hivinaynair/return-desk-cloud-test/issues/35#issuecomment-5927272485)
and [immutable held checkpoint](https://github.com/hivinaynair/return-desk-cloud-test/blob/3663bd37dbcfe549a4d9abff066e60755cbf734a/factory-state.json)
retain original start `1790841416972`. Workflow
`wrun_41M3V7EGTT0GP8FPHFKHFS6SFM` recorded `step_retrying` at
07:56:59.094 UTC and `retryAfter` 07:58:14.085 UTC. The engine subsequently
reported `Cursor stage time budget exhausted before launch`; it did not replace
the reserved identity, extend the 60-second station budget or call the model to
override that deterministic guard. This uses actual elapsed time and the hosted
scheduler, not a modified checkpoint clock.

Scope-removal [owner receipt](https://github.com/hivinaynair/return-desk-cloud-test/issues/36#issuecomment-5927287297)
and [immutable paused checkpoint](https://github.com/hivinaynair/return-desk-cloud-test/blob/d324f6364ca52a287f90081a6938f23374a42f18/factory-state.json)
record `Issue closed, factory label removed, or approved contract changed. No
new dispatch.` The operator removed only this synthetic trial's label as the
injected authorization fault. No manual pause or checkpoint modification was
used to produce the observed hold.

## Completion and limits

**All six trials met their expected outcomes.** Two recovery trials completed
full delivery unattended; authentication, diagnostic failure, elapsed deadline
and removed scope correctly held or paused with actual owner mentions. No
acceptance gate, evaluator or approval was weakened for a pass.

The campaign setting was removed and the active runtime rebuilt and redeployed.
A subsequent [disabled-intake probe #37](https://github.com/hivinaynair/return-desk-cloud-test/issues/37)
correctly launched no work, but exposed repeated registration receipts: the SDK
retried the reported deterministic hold three times. Only one receipt mentioned
the owner. The registration step now throws `FatalError` after persisting the
hold and owner receipt. Busy leases remain explicitly retryable. A subprocess
regression checks the actual failure-recording function, one checkpoint and one
owner receipt; it isolates Workflow mocks from the provider tests.

The [live retest #38](https://github.com/hivinaynair/return-desk-cloud-test/issues/38)
rejected the disabled fault intake with one registration start, zero SDK retries,
one classified receipt and [one owner mention](https://github.com/hivinaynair/return-desk-cloud-test/issues/38#issuecomment-5927444143).
Workflow `wrun_41M3V87C2V0GGY1GSQQ84GKH58` records one registration
`step_failed` and no `step_retrying`. No batch or worker was registered.

Final active runtime source `8703a3d815d88835304768062d6480b112879249` is READY
as `vipernxt-factory-jlwd8p8ga-vinaynair-projects.vercel.app`
(`dpl_FvUfuekoNe8a48uZRfSG3zgtG3vB`); the production alias resolves to that
deployment. `FACTORY_FAULT_CAMPAIGN` is absent from project settings. Unsigned
Cursor callbacks return 401 on both URLs. Strict Eve types, required root checks,
production build and [final source CI](https://github.com/hivinaynair/vipernxt/actions/runs/36834444262/job/110278349261)
pass. The final suite is **440 tests, zero failures, 48 files**, including 257
Eve tests. Both generated function limits remain 60 seconds. Historical immutable
campaign deployments retain their original environment snapshots; fault injection
is disabled on the current active runtime, as the live retest demonstrates.

Hosted readiness remains **9/10 for this bounded engineering workflow**,
supported by stronger failure evidence. Physical
cold-process failure, long-duration reliability, empirical model-confidence
calibration and customer MVP acceptance require separate evidence. This is a
rubric-based assessment, not a reliability probability or a claim of perfection.
