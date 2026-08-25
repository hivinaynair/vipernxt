---
name: setup
description: >-
  Provisions a new product's infrastructure — GitHub repo, Neon databases, Vercel
  project, Linear team — by running a staged script rather than a sequence of
  agent tool calls. Use when starting a new product from the boilerplate or when
  connections are missing.
---

# setup

Run [setup.sh](setup.sh). Do not do this with tool calls.

```bash
./.agents/skills/setup/setup.sh
```

## Why a script and not an agent

**Determinism.** Provisioning is the same six steps every time. A script does them
identically; an agent improvises, and improvisation against live infrastructure is how
you end up with two Neon projects named slightly differently.

**Cost.** `gh`, `vercel` and `neonctl` are already installed and authenticated. Driving
them through bash costs a few tokens; driving equivalent MCP servers loads tool schemas
into context for the whole session whether or not they are used.

**Review.** The user can read the script before it touches their accounts. They cannot
read your intentions.

**Re-runnability.** It is idempotent — it skips what exists. An agent re-running the same
provisioning conversation produces duplicates.

## What it does

| Stage | Tool |
|---|---|
| Preflight — tools present and authenticated | `gh`, `neonctl` |
| Private GitHub repo, pushed | `gh repo create` |
| Two Neon projects: `<product>-staging`, `<product>-production` | `neonctl` |
| Connection strings into `.env.local`, direct URLs into GitHub environment secrets | `neonctl`, `gh secret` |
| Vercel link | `vercel link` |
| Linear team key recorded | manual — no API for team creation |

## What it deliberately leaves alone

**Clerk keys.** Pasted by hand from the dashboard. Never ask an agent to handle them and
never read them into context.

**Linear team creation.** No API exists. The script prints the URL and records the key
once they have made it.

**Deployment.** Vercel deploys from git. Setup links; it does not ship.

## Your job around it

Before: confirm the product name, and that this is the right repo.

After: read the summary back — what was created, what was skipped, what still needs their
hands. If a stage failed, say which and why; do not silently retry it with tool calls.

If a stage fails repeatedly, that is a `gather` item, not a puzzle for you to brute-force
against someone's live infrastructure.
