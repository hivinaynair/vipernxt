# Eve factory

Experimental Vercel-hosted factory. A trusted `factory` label plus a valid
coverage catalog starts a batch. There is no `FACTORY_ENABLED` deploy switch.
The legacy Fly controller has been removed from the kit. Hosted two-slice
recovery remains required before treating this as unattended production.

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
agent-mode reviewer (Claude when listed) reviews that exact commit and must
return one JSON object. Slice review may `request_changes` at most twice, then
holds. Unreadable JSON is retried separately so a schema miss does not spend
the product revision budget. Delivery is a draft PR. Every transition posts an
issue receipt.

There is **no cron schedule**. Before each Cursor launch the workflow registers
`cursor:<agent-id>` as a durable hook. The product's stop hook sends a short-lived
Cursor-signed OIDC token to `/callbacks/cursor`. The endpoint checks issuer,
audience, expiry and the registered agent identity, then wakes that hook.
The command consumes Cursor stop-event JSON on stdin and returns `{}` on stdout.
The callback body cannot approve anything. **Deadline or callback is enough.**
The workflow then reads Cursor's actual run status and the branch SHA.
If a previous run still holds the `cursor:<agent-id>` wake token, the new
workflow waits on the deadline only and keeps ticking.

A stop hook can arrive before the terminal API status. A short settling window
handles that race. A missed first-turn hook is not a failed slice. Deadline
exhaustion holds execution rather than silently granting more time. Completed
workflow steps are replayed, not rerun.

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

Jev classifies blocked failures in shadow mode. It cannot accept a slice, change
scope or reset budgets. It does decide **attention**: `owner` (you need to look)
or `eve` (the coordinator may continue inside the approved contract).
`retry_read` and `repair` are Eve-delegable; `ask_owner` and `stop` hold.
`classify_failure` never 403s — missing state returns `no_batch`. When Eve may
resume, `classify_failure` claims the workflow and continues the durable station
loop itself so the composer does not have to call `start_batch` again. A factory
label session cannot substitute `factory_status` for `start_batch`. Cursor
`ERROR`/`EXPIRED` and unreadable review JSON retry inside the engine; Jev routes
those same strings without calling the model if a prior deploy left them blocked.

Owner attention is a pager, not a second work queue. The first owner hold for an
issue+error @mentions `FACTORY_OWNER` on the GitHub receipt and posts Slack when
configured. Slack **Hold** leaves Eve stopped, **Retry** dispatches `start_batch`
for the same issue and intake (no extra budget or scope), and **Reject** archives
the batch and drops the `factory` label. Thread replies become issue comments.
Secrets pasted in Slack are dropped. Slack cannot approve a slice.

Set `FACTORY_OWNER` (GitHub login). For Slack buttons and replies, set
`SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_OWNER_CHANNEL`, and
`SLACK_OWNER_USER_ID`, then point Event Subscriptions and Interactivity at
`https://<factory>/callbacks/slack`. `SLACK_OWNER_WEBHOOK` is a text-only fallback
without buttons. Inbound Slack is ignored unless the acting user is
`SLACK_OWNER_USER_ID`.

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
Hook diagnostics are also recorded without tokens in
`/tmp/vipernxt-factory-hook.jsonl` inside the agent VM.

## Scope coverage

New batches require a pinned `coverageFile`; see [coverage planning](COVERAGE.md).
It reconciles every pinned journey criterion with a job or existing evidence,
enforces declared cross-cutting prerequisites, and distinguishes first-slice scope
from the entire MVP. A separate final Cursor review must verify all requirements
on the combined candidate before draft-PR delivery. Interactive journeys require
browser verification. Older manifests and registered batches without coverage
fail closed and need a newly approved batch; they are not retroactively certified.
These local checks do not replace the still-pending hosted end-to-end test.
