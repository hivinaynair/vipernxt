# Eve factory

Experimental Vercel-hosted factory. A trusted `factory` label plus a valid
hash-bound readiness packet and coverage catalog starts a batch. There is no `FACTORY_ENABLED` deploy switch.
The legacy Fly controller has been removed from the kit. The [hosted benchmark](evals/hosted.md) demonstrates bounded two-slice staging
delivery and real coordinator continuation. Production release remains a separate gate.

Install and validate with `bun install --frozen-lockfile`, `bun test`,
`bun run check-types`, and `bun run build`. Vercel uses Node.js 24 at runtime.
The package is independent of the product application's dependencies.

## Execution

A trusted GitHub `factory` label event opens an Eve session. `start_batch` reads
one `factory-batch` block containing an immutable commit and manifest path.
The intake commit must sit on the target branch (HEAD or ancestor).
`manifest.base` may be that intake or an earlier ancestor — it must not equal
the moving branch tip. Workers start from the intake tree so pinned catalogs
exist. It validates the manifest and pinned artifacts, then runs as a durable
background workflow. Cursor Grok 4.6 implements each slice from a pinned
`factory/input/<agent-id>` ref and must push one `cursor/` branch. A separate
agent-mode reviewer from a different recognized vendor (Claude when listed) reviews that exact commit and must
return one JSON object. Slice review may `request_changes` at most twice, then
holds. Unreadable slice output or terminal reviewer errors reserve a fresh reviewer of the same candidate, twice at most, preserving the original stage clock. At integrated/deployed review, a contradictory approval whose required checks all pass but whose supplementary check fails is rejected and can use that same bounded fresh-verification mechanism. Failed required checks still hold immediately; rejected reports never count as acceptance. Code revisions start from the rejected candidate and consume build attempts. Advisory notes cannot erase blocking findings. Delivery creates a draft PR; [approved CI repair and automatic staging](AUTOMATION.md) can continue unattended to deployed acceptance. Meaningful transitions post issue receipts.

There is **no cron schedule**. Before each Cursor launch the workflow registers
`cursor:<agent-id>:<workflow-owner>` as a durable hook. The product's stop hook sends a short-lived
Cursor-signed OIDC token to `/callbacks/cursor`. The endpoint checks issuer,
audience, expiry and the registered agent identity, then wakes that hook.
The command consumes Cursor stop-event JSON on stdin and returns `{}` on stdout.
The callback body cannot approve anything. Durable reconciliation or callback is enough.
The workflow then reads Cursor's actual run status and the branch SHA.
Adoption uses a fresh owner suffix for Cursor, CI, deployment and retry hooks,
so a predecessor cannot retain its successor's wake token. Callback routes use
the current checkpoint owner. SDK hook-conflict rejections use the bounded
reconciliation path; an obsolete workflow stops without retrying an engine step.

A stop hook can arrive before the terminal API status. Durable reconciliation
handles that race. A missed first-turn hook is not a failed slice. Deadline
exhaustion holds execution rather than silently granting more time. Completed
workflow steps are replayed, not rerun.

## Bounded hosted simulations

For an operator-authorized technical benchmark, set `FACTORY_SIMULATION_REPO`
to the exact disposable repository and pin `simulation: true` in its manifest.
The target must be `staging`, scope must be `first-slice`, and the run is limited
to two jobs, two attempts, 20-minute stations and a two-hour batch. Registration
is explicitly reported as `simulation-registered`. Synthetic walkthroughs stay
labelled as simulations; this mode cannot certify an MVP or replace customer
approval. Without both bindings, hosted intake still requires observed discovery.

## Product hook

Copy `hooks/cursor-stop.mjs` to `.cursor/hooks/factory-stop.mjs`, and add a `stop`
entry to the existing `.cursor/hooks.json` (preserving other hooks):

```json
{"command":"node .cursor/hooks/factory-stop.mjs","timeout":40}
```

Create `.cursor/factory.json` with `callbackUrl` set to the deployment's HTTPS
`/callbacks/cursor` URL. Set `FACTORY_CALLBACK_AUDIENCE` to that URL's origin.
No Cursor API key belongs in the product repository or hook.

## Limits and verification

GitHub's `factory/state` branch holds checkpoints with compare-and-swap writes.
One batch is supported per deployment. A fresh authorized `factory` label event
can resume a blocked batch with the same issue and intake, within its original
time budget. Agent identity, attempts, clocks and accepted evidence are retained.
A new authorized label for a different batch archives the previous checkpoint
automatically, including a still-running station. Same issue and intake resume
instead of starting a second batch. Register failures persist `lastFailure` and an issue receipt so
the next label can start.

Cursor starts from a dedicated `factory/input/<agent-id>` branch whose head is
checked against the approved commit. This works around a raw-SHA launch rejected
by the live Cursor v1 API. Implementers use Grok 4.6 in agent mode. Reviewers
use a different model from `GET /v1/models` (Claude when listed,
otherwise any non-builder model) and must return JSON. A fresh authorized label can adopt a running, blocked, or paused batch
(same issue and intake) so a new deploy can take over an in-flight station.
`invalid_model` is owner configuration, not an Eve repair.

The build limits generated Vercel function invocations to 60 seconds, shorter
than the five-minute lease expiry.

Jev is an advisory classifier (`mode: shadow` means the model cannot execute),
and the durable driver now invokes it automatically before owner paging. Typed
read failures may resume; ambiguous launches first reconcile the same reserved
Cursor identity. A bounded read-only investigator collects at most two Cursor
records, then Jev receives one additional diagnostic pass. Investigation cannot
launch a worker or write. Verified terminal runs and unreadable reviews can be
replaced within the existing phase budget; active work is never duplicated.
Unknown write outcomes without conclusive evidence hold for the owner.

Model recommendations for `repair` or `retry_read` require a complete probability
distribution, a unique selected route and probability at least 0.8. This is a
conservative initial policy, not a calibrated accuracy claim. Weak/missing
confidence investigates once; unavailable or inconclusive diagnoses end in an
owner hold. Scope, credentials, policy, rejection and exhausted-budget guards
bypass the model. Every recovery independently rechecks the complete intake
hash, original batch/station deadlines, phase-specific budget and checkpoint
lease. Recovery counters cap additional triage continuations at two per phase,
job and candidate. Classification caching includes that evidence and budgets.
Registration failures have no approved batch and cannot resume automatically.

`classify_failure` remains a manual diagnostic entry point; when recovery is
safe it claims the workflow and continues the same durable loop. Missing state
returns `no_batch`, not an access error. A factory label session must still call
`start_batch`. Ordinary worker `ERROR`/`EXPIRED` and review-format failures retain
their engine retries. Builder replacements preserve the original stage clock.

The [triage validation report](evals/triage.md) records the current checks.
The fault suite in `test/recovery.test.ts` exercises the actual engine,
automatic driver and triage using injected provider responses, through accepted
slice/integrated checkpoints and owner holds. It includes lost launch responses,
weak confidence, model outages, uncertain writes, expired clocks, revoked
credentials and authorization changes. Those deterministic fixtures are separate
from the [controlled hosted failure campaign](evals/hosted-faults.md), which
records real worker reconciliation, Jev routing and staging dispatch recovery.
The prior hosted happy-path completion remains documented in
[evals/hosted.md](evals/hosted.md).

Owner attention is a pager, not a second work queue. The first owner hold for an
issue+error @mentions `FACTORY_OWNER` on the GitHub receipt and queues Slack when
configured. Alerts explain the failed task, attempted recovery, needed action and
evidence links. Delivery uses a separate checkpoint and bounded durable retries;
uncertain POSTs are reconciled through history instead of being reposted. Slack
**Hold** leaves Eve stopped, **Retry** dispatches `start_batch`
for the same issue and intake (no extra budget or scope), and **Reject** archives
the batch and drops the `factory` label. Thread replies become issue comments.
Secrets pasted in Slack are dropped. Slack cannot approve a slice.

Set `FACTORY_OWNER` (GitHub login). For Slack buttons and replies, set
`SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_OWNER_CHANNEL`, and
`SLACK_OWNER_USER_ID`, then point Event Subscriptions and Interactivity at
`https://<factory>/callbacks/slack`. `SLACK_OWNER_WEBHOOK` is a text-only fallback
without buttons. Inbound Slack is ignored unless the acting user is
`SLACK_OWNER_USER_ID`. Buttons are bound to the current notification and confirmed
message; stale controls cannot affect another batch. Follow the
[Slack setup guide](SLACK.md) and [private-channel app manifest](slack-app-manifest.yaml)
to install and verify live delivery.

Local tests cover acceptance, scope, dispatch reconciliation, leases, owner pager
and callback authentication. Hosted workflow replay, real stop-hook delivery and end-to-end
Cursor verification must be tested separately. An agent's evidence report is
not a cryptographic proof that tests ran.

Based on the MIT-licensed Vercel Foreman template at
`0d630a284b84e5be38fe7eceec7b231a7e79bfd0`; see `FOREMAN-LICENSE`.

## Hook verification

Cursor documents that project command hooks run only after the agent enters a
writable environment. Reviewers explicitly initialize that environment with a
temporary repository file, removed immediately; tracked files remain unchanged.
On 2026-09-20, Return Desk staging `4bfed95` with an active Cursor Build that
installs Bun and Playwright: a fresh agent's **first** turn finished with
`/run/cursor/api.sock` present but **no** POST to `/callbacks/cursor`. A
**follow-up** run on the same agent delivered `POST /callbacks/cursor` with
HTTP 204 automatically. Do not claim first-turn delivery; Eve's durable
deadline remains the wake path when the first stop hook is missing. This proves
follow-up delivery and OIDC wiring, not acceptance or batch completion.
The two-slice hosted trial remains experimental.

References: [Cursor hooks](https://cursor.com/docs/hooks) and
[Cursor identity](https://cursor.com/docs/cloud-agent/identity).

Runtime preflight requires `.cursor/environment.json` and `.cursor/Dockerfile`
alongside the three hook files in `specFiles`. Those five files must match the
repository default branch because Cursor Builds use its configuration. The
environment must declare its Dockerfile and install command. This source check
does not prove the active Cursor Build is fresh: verify that Build separately
before dispatch. The install command must include `bun install --frozen-lockfile`.
Exercise the product's full verification suite in that image, including its
fixture dependencies. The Return Desk pilot needs ZIP and Pandoc for document
fixtures and an explicit `commit.gpgsign=false` runtime override for temporary
Git commits; inherited VM signing can otherwise hang those tests. Startup
should check the required tools. Report final observed command results once,
preserving failed setup attempts and excluded-journey outcomes in review notes.
Final required failures still block acceptance.
For pinned evaluators with nonstandard names, use an explicit relative path,
for example `bun test ./e2e/comparison/selection.eval.ts`. Without `./`, Bun
treats the argument as a discovery filter and can silently skip it when other
tests match. Intake rejects this mistake in declared job, integrated and
deployed commands before reserving a worker. Opaque test scripts still need
their own checks that the intended cases executed.
Hook diagnostics are also recorded without tokens in
`/tmp/vipernxt-factory-hook.jsonl` inside the agent VM.

## Scope coverage

New batches require pinned `requirementsFile`, state, authoritative contracts and `coverageFile`; the [packet gate](../../docs/playbook/requirements-packet.md) binds their exact scope and approved actions. see [coverage planning](COVERAGE.md).
It reconciles every pinned journey criterion with a job or existing evidence,
enforces declared cross-cutting prerequisites, and distinguishes first-slice scope
from the entire MVP. A separate final Cursor review must verify all requirements
on the combined candidate before draft-PR delivery. Interactive journeys require
browser verification. Older manifests and registered batches without readiness or coverage
fail closed and need a newly approved batch; they are not retroactively certified.
The [hosted evaluation](evals/hosted.md) completed the bounded two-slice CI,
automatic staging and actual-site acceptance path. Local tests alone do not
certify customer behavior or broader provider-failure windows.

## Opt-in hosted fault campaign

A simulation manifest may include `faults: { campaign, cases }`. Registration
requires the matching non-secret `FACTORY_FAULT_CAMPAIGN` deployment setting,
`simulation: true`, the exact configured disposable repository, and staging.
Normal/customer manifests cannot opt into faults. Existing simulation station,
attempt and time caps apply. There is no public fault-control endpoint.

`faultLedger` checkpoints each consumed injection before its effect, so a restart
cannot replay it indefinitely. The supported probes discard real Cursor launch
or read responses, fail a durable step after reservation, discard a real staging
dispatch response, send scoped invalid-auth requests, or delay a reservation past
its original deadline. Invalid-auth probes use a test token without changing any
real secret. A Jev-unavailability trial caps its diagnostic provider failures.
Read-response failures are controlled injection after successful real reads,
not evidence of a spontaneous upstream outage. A workflow-step retry does not
by itself prove a physical cold-process restart.

Disable the campaign setting and redeploy after testing. Fault manifests then
reject registration, and historical fault plans cannot inject into normal work.
The [campaign report](evals/hosted-faults.md) records actual observations rather
than crediting unrun cases.
