# Slack owner notifications — 1 October 2026

The owner pager is implemented and deployed. **Real Slack delivery and a real
owner response are not yet verified:** all four Slack production bindings are
absent. See [setup instructions](../SLACK.md) and the
[private-channel app manifest](../slack-app-manifest.yaml).

## Verified behavior

Alerts include the failed task, attempted recovery, needed action and evidence
links. They are queued only for an owner hold, after bounded recovery decisions.
Checkpointed notification identity, claims, confirmation and a separate
three-attempt budget protect against duplicate side effects. Definite rate limits
wait durably; uncertain sends reconcile history without blind reposting.
Permanent failures remain visible through GitHub. Missing configuration stays
`unconfigured` with zero attempts rather than claiming delivery.

Owner callbacks require current signatures and the configured owner. Buttons are
bound to the current notification, channel, message and held workflow. Old
controls cannot reject a newer batch, including a newer held workflow on the same
issue. Retry requires the original approved intake hash, label, batch/station
clocks and attempt limits; repeated callbacks cannot dispatch it twice. Host
`waitUntil` acknowledges Slack before checkpoint I/O completes. Slack never
approves scope, acceptance or releases.

## Local validation

- **466 root tests, zero failures, 50 files**, including 283 Eve tests and 26 new
  notification/owner-control regressions.
- Strict Eve types, required root checks and production-target build pass.
- Both generated functions retain their 60-second invocation limit.
- Tests cover explicit Slack success, `ok:false`, authentication errors, malformed
  replies, HTTP failures, rate limits, lost responses, replay after a claimed
  POST, conflicting checkpoints, lease deferral, exhausted budgets, text
  redaction, stale controls and owner authorization. A subprocess check verifies
  durable sleeps and the GitHub failure projection.
- [Runtime-source CI](https://github.com/hivinaynair/vipernxt/actions/runs/36844242854/job/110310436550)
  passes at `e9f5d9c1436b2b27c7cbde2156bfbb5e628d569f`.

## Hosted validation

Active source `e9f5d9c1436b2b27c7cbde2156bfbb5e628d569f` is READY at
`vipernxt-factory-hi6b8mw4g-vinaynair-projects.vercel.app`
(`dpl_vCXMACbjffSxmQ2UmmPZAfYGTbAM`), with the production alias
`https://vipernxt-factory.vercel.app`. Metadata identifies
`factoryFeature=confirmed-slack-owner-alerts`. Unsigned Slack and Cursor callbacks
return 401. `FACTORY_FAULT_CAMPAIGN` remains absent.

[Probe #39](https://github.com/hivinaynair/return-desk-cloud-test/issues/39) at
source `56510165032564a6fde4e4e444b87e58ba25052c` produced exactly one
[classified owner receipt](https://github.com/hivinaynair/return-desk-cloud-test/issues/39#issuecomment-5928766426),
one owner mention, one registration start and zero registration retries.
[Checkpoint `9e0aae58`](https://github.com/hivinaynair/return-desk-cloud-test/blob/9e0aae58ddb28b68c619ace42390bbc5c4736fe6/factory-state.json)
records the full alert snapshot with `slack.status=unconfigured`, `attempts=0`,
no registered batch and no worker. Workflow
`wrun_41M3VD43P20GV2JA75FBJ8R61Y` completed the notification `pendingKey` step
without a delivery POST. Its preliminary model prose incorrectly announced
running before registration; status instructions were tightened to report only
confirmed checkpoints and distinguish Eve orchestration from registered work.

[Retest #40](https://github.com/hivinaynair/return-desk-cloud-test/issues/40) on the active source recorded the same hold,
one [owner receipt](https://github.com/hivinaynair/return-desk-cloud-test/issues/40#issuecomment-5928865175), one owner mention,
one registration start and zero retries. Its first message correctly reported
**dispatch requested, pending registration**; its final message correctly stated
that no factory batch or Cursor worker was registered.
[Checkpoint `3452e13d`](https://github.com/hivinaynair/return-desk-cloud-test/blob/3452e13db318c3c82df7d3fda347950d8a042f21/factory-state.json)
still records `unconfigured`, zero attempts and no batch. Workflow
`wrun_41M3VDGDWT0GSEDWXWRYMDM002` completed the notification `pendingKey`
step without a delivery POST. Model prose remains advisory; the checkpoint and
classified receipt supply the authoritative state.

## Outstanding live checks

Install the app and add `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`,
`SLACK_OWNER_CHANNEL` and `SLACK_OWNER_USER_ID` securely to the factory project's
Production environment. Redeploy, verify Slack's signed URL challenge, then run a
controlled owner hold and click Hold as the configured owner. A real channel/ts
receipt and real owner click are required before declaring Slack live-verified.
Local provider mocks and an unconfigured hosted hold do not substitute for those
checks. An inbound process interrupted after its retry checkpoint still requires
checking GitHub before fresh authorization.

The earlier bounded factory readiness assessment remains 9/10; this work does not
claim perfect reliability or customer MVP acceptance. The prior
[hosted failure campaign](hosted-faults.md) remains valid historical evidence.
Production main is unchanged; this work stays in draft PR #33 targeting staging.
