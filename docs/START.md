# Start with your idea; connect the factory when you're ready

## Local requirements stage

Install Bun 1.4.0, Node.js 24 and Git. Use your own fork/copy and ensure its origin points to your product repository. Install with `bun install --frozen-lockfile`, then run `bun run setup`. This creates a private, ignored `.env.factory.local` without provisioning services, spending credits or overwriting an existing file.

Run `bun run doctor --stage=shape`, open an editor that supports the included skills and invoke /next. No factory tokens are needed for this stage; your editor's own model access is separate. Requirements and decisions live in your clone.

Create a staging branch from your default branch if it is missing, then branch product changes from staging. Keep the repository default branch's factory controls synchronized with approved intake controls.

## Credentials

Fill `.env.factory.local`; exported environment variables take precedence. The parser treats values as data and never executes shell substitutions. Secret files are owner-readable and ignored by Git. Do not paste tokens into issues, Slack or agent chat.

| Variable | Source / use |
|---|---|
| CURSOR_API_KEY | [Cursor Cloud Agents API](https://cursor.com/docs/cloud-agent/api/overview), Cursor Settings → Cloud Agents → API keys. Enable repository access and configure its active Build. |
| AI_GATEWAY_API_KEY | [Vercel AI Gateway](https://vercel.com/docs/ai-gateway/authentication-and-security), AI Gateway → API keys. Funds/entitlement must cover Eve's selected coordinator and typesafe-ai/jev. |
| VERCEL_TOKEN | [Vercel account tokens](https://vercel.com/account/settings/tokens), deployment account access to your factory project. Never use an AI Gateway token here. |
| FACTORY_REPO / FACTORY_OWNER | Product owner/repo and GitHub owner login; explicit owner decisions use this identity. |
| FACTORY_BASE_BRANCH | Product integration branch; default staging. |
| FACTORY_PROJECT_NAME | Your factory's Vercel project name, separate from the product application. |
| FACTORY_CALLBACK_AUDIENCE | Stable HTTPS factory origin, e.g. https://your-factory.vercel.app; no path/trailing slash. |
| GITHUB_CONNECTOR | Your [Vercel Connect](https://vercel.com/docs/vercel-connect) GitHub connector reference. |
| FACTORY_PROJECT_ID / VERCEL_TEAM_ID | Optional existing project/team IDs; linkage supplies IDs when absent. |
| FACTORY_MODEL | Optional AI Gateway coordinator model ID; changing it requires validating tool use. Jev remains a separate model. |
| SLACK_BOT_TOKEN / SLACK_SIGNING_SECRET | Slack app OAuth bot token and App Credentials signing secret. |
| SLACK_OWNER_CHANNEL / SLACK_OWNER_USER_ID | Channel ID and authorized owner's member ID; invite the bot. |
| SLACK_OWNER_WEBHOOK | Optional text-only fallback without buttons or thread commands. |

There is no standalone Eve token. Eve's inbound channel uses local-development authentication or Vercel OIDC; this starter does not expose an unrestricted bearer endpoint.

## Hosted factory

Run these in the repository root:

```sh
bun run doctor                  # presence/format, no secret output
bun run factory:verify          # read-only Cursor/Vercel and configured Slack auth checks
bun run factory:link            # links deploy/eve to your explicit factory project
bun run factory:env             # production sync preview
bun run factory:env --apply     # sync only listed runtime keys
bun run factory:deploy          # production deployment of the factory, not your product
```

Install Eve dependencies with `cd deploy/eve && bun install --frozen-lockfile` before building/deploying. The pinned CLI uses Node.js 24. If link creates a new project, its provider charges follow your account; init/doctor/verify do not create resources.

Environment sync requires your selected project, rejects conflicting project/team identity, preserves unrelated keys/targets, and refuses entries shared between production and preview. Separate those entries in Vercel before updating. It never uploads VERCEL_TOKEN or CLI project/team selectors to Eve. Missing values are not deleted; remove obsolete keys explicitly in provider settings. Deployment activates changes.

A verification success confirms API access, not the whole factory. AI Gateway configuration is reported separately: the read-only check does not spend model credits or verify inference/entitlement. Run a controlled approved simulation to verify coordinator and Jev behavior.

### Finish the provider connections

1. Install the GitHub App/Connect integration on the product repository. Enable issue, pull-request, check-suite and workflow-run events, with the /eve/v1/github trigger. Grant required repository contents/ref, issue, PR, Actions and deployment access; limit the installation to intended repositories. See [Eve execution](../deploy/eve/README.md).
2. Install the factory stop hook and callback configuration described in [Eve](../deploy/eve/README.md). Commit the pinned hook/environment/Dockerfile controls to the product repository's default and intake branches. Refresh and verify the **active Cursor Build** with Bun, required test tools and runtime secrets; source files alone do not prove the image is ready.
3. For approved automatic staging, configure a dedicated product staging target and GitHub staging environment. Store product deployment credentials as **GitHub Actions secrets**, not plain variables; project IDs/origin are configuration. The factory's credentials do not automatically configure product CI. Follow [AUTOMATION](../deploy/eve/AUTOMATION.md).
4. Optionally run `bun run doctor --slack` and follow [Slack installation](../deploy/eve/SLACK.md). Live verification requires the signed URL challenge, an actual alert and an authorized owner click.
5. Validate the [requirements packet](playbook/requirements-packet.md) and [MVP coverage](../deploy/eve/COVERAGE.md), review the first slice, then authorize remaining work. Configuration commands never add a factory label or launch workers.

Product provisioning after slice acceptance follows the selected [recipe](kit/recipe.yaml) and [setup skill](../.agents/skills/setup/SKILL.md). Clerk cloud sign-in needs dedicated test users and [runtime auth secrets](kit/cloud-auth.md).

## Local factory development

`bun run factory:dev` loads the same root credential file into Eve's local dev process. `bun run factory` is the local development runner; it also reads this file. Local runs do not replace a durable hosted supervisor. Never point simulations at customer repositories or production environments.
