# Eve owner alerts

Eve queues Slack only when recovery concludes that an owner decision is needed.
The alert names the failed task, explains what Eve tried and what it needs, and
links the GitHub evidence. GitHub remains the fallback when Slack is unavailable.

## Connect a private channel

1. Create a Slack app **From a manifest** at <https://api.slack.com/apps> using
   [slack-app-manifest.yaml](slack-app-manifest.yaml). The supplied callback is
   `https://your-factory.vercel.app/callbacks/slack`; replace both URLs with your own factory origin. For a new app, initially omit the entire
   `event_subscriptions` section; Slack verifies that URL after the signing secret
   is deployed in step 4. Keep Interactivity configured.
2. Install the app to your workspace. Create a private operations channel and
   invite **Eve Factory**. This manifest uses `chat:write` and `groups:history`:
   posting and reading messages in that channel, plus receiving thread replies.
   `metadata.message:read` lets Eve confirm the notification's stable identity
   after an uncertain send.
3. In Vercel project **your factory → Settings → Environment Variables**, set
   these for **Production**. Enter credentials there, never in chat or Git:

   | Variable | Where to get it |
   | --- | --- |
   | `SLACK_BOT_TOKEN` | Slack app → OAuth & Permissions → Bot User OAuth Token (`xoxb-…`) |
   | `SLACK_SIGNING_SECRET` | Slack app → Basic Information → App Credentials → Signing Secret |
   | `SLACK_OWNER_CHANNEL` | Private channel ID from channel details; use the ID, not the name |
   | `SLACK_OWNER_USER_ID` | Your Slack profile → More → Copy member ID |

4. Redeploy the factory so it receives the new environment values. Enable Event
   Subscriptions using the callback URL above and subscribe to `message.groups`.
   Slack's signed URL challenge should verify. Confirm Interactivity uses the same
   URL. If scopes changed on an existing app, reinstall it.
5. Run a controlled owner-hold case in the disposable pilot repository. Check the
   alert and GitHub receipt; click **Hold** as the configured owner. Confirm the
   issue receives the owner decision and the batch remains held. A real alert and
   owner reply are required before calling the integration live-verified.

The private-channel manifest is the default. A public channel instead needs
`channels:history` and `message.channels`; a direct message needs `im:history`
and `message.im`, plus a real conversation ID. Avoid adding unrelated scopes.

## Decisions and delivery

- **Hold** records the owner decision and leaves a held batch stopped. Intake
  validation failures have only Hold: no batch exists to resume or archive.
- **Retry** requests the same approved issue and intake. It checks the current
  label, approval hash, original batch/station clocks and attempt limits. It cannot
  grant more time or scope. Repeated callbacks do not dispatch another retry.
- **Reject** archives only the current held batch for that issue and removes its
  `factory` label. It cannot archive a newer or running batch.
- Thread replies from `SLACK_OWNER_USER_ID` become issue evidence. Only exact
  `hold`, `retry`, or `reject` text requests a command; prose is never an agent
  instruction. Recognized credentials are dropped from replies and redacted from
  alerts. Keep credentials in provider settings.

Requests require Slack HMAC signatures within five minutes and the configured
owner identity. Buttons also require the current notification ID, confirmed
message timestamp and channel. Old buttons are inert. Callbacks acknowledge
immediately while Eve's host completes checkpoint work through `waitUntil`.

Alerts are checkpointed before any Slack POST, with a stable message ID and a
separate three-attempt delivery budget. Rate limits use durable sleeps and the
provider's Retry-After. A response must explicitly confirm Slack success; a 200
with `ok: false` is a failure. A timeout, lost response or replay after a claimed
POST uses bounded **read-only** history reconciliation. Eve never blindly reposts
an uncertain message. Missing history permissions can therefore leave delivery
unconfirmed, with a visible GitHub fallback. Factory recovery clocks and authority
are independent of notification delivery.

`SLACK_OWNER_WEBHOOK` is an optional incoming-webhook fallback: text alerts with
the failure, attempted recovery, needed action and evidence link. It has no
buttons or thread commands. An uncertain webhook response stays unconfirmed;
Eve cannot read back a webhook message identity safely.

## Evidence and limits

Local tests exercise confirmed delivery, API/authentication errors, rate limits,
lost responses, replay, conflicting checkpoints, exhausted retries, secret
redaction, stale controls and owner authorization. A subprocess test verifies
durable notification waits and the GitHub fallback projection.

The implementation can be deployed without Slack bindings; notification status
then remains `unconfigured`. That does **not** prove Slack delivery. Live delivery,
Slack URL verification and a real owner click must be checked after installation.
An interrupted inbound handler after its retry checkpoint can leave the dispatch
unconfirmed; Eve holds the original limits and requires checking GitHub before
any new authorization. Slack does not approve requirements, acceptance or releases.

Provider references:
[chat.postMessage](https://docs.slack.dev/reference/methods/chat.postMessage/),
[conversations.history](https://docs.slack.dev/reference/methods/conversations.history/),
[private-channel messages](https://docs.slack.dev/reference/events/message.groups/),
and [interaction acknowledgements](https://docs.slack.dev/interactivity/handling-user-interaction/).
