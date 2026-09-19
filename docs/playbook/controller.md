# ViperNxt controller: approved Git scope, Linear commands, Cursor execution

Implemented for one owner, one workspace and one active batch. Fly hosting has passed deployment smoke checks and a real Linear session received a controller response. A cloud batch still requires live validation before unattended use. This service is optional; the local playbook and Git requirements can be used without Linear or this controller. The controller never runs product setup/build/test commands on its own host when using the required `verification: "cursor-cloud"` manifest setting. A separate Cursor run verifies the candidate and returns structured evidence; these are agent-reported checks, not independently executed CI.

## Commands

Mention the installed ViperNxt app with exactly one command: `build`, `status`, `pause`, `resume`, `cancel`, or `retry`. A bare mention shows status. Unknown text returns help; prose is never executed. Only configured user IDs may control registered scope. For a multi-ticket batch, commands go on its registered parent issue. Its children are not independent entry points; prepare a separate one-job batch for a standalone ticket.

`build` queues the registered scope once. `pause` lets active verification/integration finish, then prevents further jobs/retries. `resume` continues paused work or reconciles a blocked attempt. `cancel` requests remote cancellation, preserving evidence. `retry` only restarts definite failures with remaining attempts; it never replenishes the approved budget. Automatic repair normally consumes that budget before manual retry. Scope changes require a new approved registration. Completed batches cannot be restarted.

Accepted jobs move to In Review. This version does not mark them Done, merge staging or deploy production. First-slice acceptance remains a human decision. Cursor run links appear in session progress. A failed reporting request stays queued with backoff.

## Linear app

Create an OAuth application named **ViperNxt** in the intended workspace. Enable **client credentials tokens** and **Agent session events**. Configure the webhook as `https://APP.fly.dev/webhooks/linear`. The service requests `read,write,app:mentionable,app:assignable`, obtains an app actor token, and renews after expiry/401. No browser-session credential or personal API key is used. Restrict app access to Return Desk.

This follows [Linear's app identity](https://linear.app/developers/agents), [client credentials](https://linear.app/developers/oauth-2-0-authentication) and [agent sessions](https://linear.app/developers/agent-interaction), checked 2026-09-14. APIs are developer preview. Test mention payloads and activity mutations against the installed app before releasing a batch.

## Fly setup

Use `deploy/controller/Dockerfile` and `deploy/controller/fly.toml`. Set the app name, create one `factory_data` volume, and deploy **one** Machine (`fly deploy --ha=false --config deploy/controller/fly.toml`). Keep autostop disabled. The foreground Bun service holds a single-host lock; SQLite inbox/outbox/batches and product clones live under `/data`.

Set Fly secrets: `FACTORY_CONTROL_TOKEN` (random, at least 32 characters), `CURSOR_API_KEY`, `GITHUB_TOKEN`, `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET`, `LINEAR_WEBHOOK_SECRET`, and `FACTORY_CONFIG_JSON` (contents of the example config, adjusted for your account). Alternatively mount the nonsecret config at `/data/controller.json`. Never put secrets in Git, tickets, logs or worker prompts. GitHub access must allow reading and pushing factory branches, including workflow files. Do not give Cursor workers Linear write access.

`deploy/controller/config.example.json` records the verified Bridge workspace, Return Desk team and status IDs. Revalidate after changing workspaces. `/healthz` is liveness, not proof of provider connectivity. Back up SQLite consistently with its backup API and preserve `.factory` evidence and Git objects; volume snapshots alone are not a tested recovery plan. Restoring on another host requires fencing the previous host first. Reboot and restore tests remain deployment gates.

## Register approved scope

Commit a sealed factory manifest with Cursor worker and `verification: "cursor-cloud"`. Delivery commands are rejected. Send `POST /v1/batches` with bearer controller token and an idempotency key. JSON fields: `repository` (owner/repo), `commit` (40-character SHA), `manifest` (relative path), `teamId`, `issueId` (batch parent or single issue), `jobIssues` (job ID → Linear issue UUID). Registration is approval by the configured operator; it snapshots issue content and validates pinned specs. It does not start workers.

Convenience client: `bun scripts/controller/submit.ts submission.json unique-key`, with `FACTORY_URL` and `FACTORY_CONTROL_TOKEN` in the environment. Then mention `@vipernxt build`. HTTP equivalents are `POST /v1/batches/ID/build|pause|resume|cancel|retry`; `GET /v1/batches/ID` returns status. Duplicate submission keys reconcile; changed inputs with the same key fail.

The runtime rechecks Linear before dispatch and integration. Unavailable/changed scope holds execution. Controls persist before subprocess launch; duplicate webhooks and replayed session events are deduplicated. Credentials, live installation, controller restart, verified multi-ticket execution and delivery are separate evidence classes.

## Deployment evidence — 2026-09-14

Return Desk controller: `vipernxt-controller.fly.dev`, one Machine `80190df6276438` in `ams`, encrypted 1 GB volume `vol_4919d2z3p7q9g2or`. The remote image built with Bun 1.4.0. Fly resolves the Dockerfile relative to the config directory; the template now uses `dockerfile = "Dockerfile"`. Import compact JSON config as a raw single-line value; JSON-stringifying the whole dotenv value leaves invalid escaping in Fly.

Verified HTTPS health 200, missing control authorization 401, authenticated lookup of a nonexistent batch 404, unsigned webhook 401, and duplicate signed deliveries 202 with exactly one durable inbox row. The synthetic event used an unauthorized creator, so it produced no Linear response or Cursor job. After a Machine restart, health passed and the processed inbox row remained. Linear app authentication and Return Desk access passed locally; GitHub repository read access passed on the Machine. There are zero registered batches.

A real session on RET-1 received a help response on September 14 (session 9d2f7205-8f53-4dd8-b322-fb459920706b), establishing the signed event-to-response path. This exposed structured mention parsing, now covered by a regression test. Native retry required the app:assignable scope. On September 19 the Fly Machine was started with its health check passing; 14 controller tests and type checks passed locally. A September 19 status message in that same live session returned the expected unregistered-scope response without dispatch. Still unverified: an active batch surviving restart and end-to-end execution through this deployed service. Prior local factory tests do not establish these deployment outcomes.
