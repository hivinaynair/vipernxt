---
name: setup
description: >-
  Provisions a new product's infrastructure — GitHub repo, Neon databases, Vercel
  project, Linear team — by running a staged script rather than a sequence of
  agent tool calls. Use when starting a new product from the boilerplate or when
  connections are missing.
---

# setup

Run the script. Do not do this with tool calls.

```bash
./.agents/skills/setup/setup.sh
```

It is idempotent and skips what exists. An agent improvising the same
provisioning conversation against live infrastructure produces two Neon projects
named slightly differently; the script creates **one**, with `staging` and
`production` databases inside it.

`/next` should already have run `customize`, so `PRODUCT` is in `.env.playbook`.
If it has not, the script asks once and records it. Confirm this is the right
repo before starting.

## Read but never echo

`clerk env pull` writes the env file itself — development keys never pass
through the script, never appear in output, and never reach your context.
Production keys are pulled at deploy time with `--instance prod`. Do not read
any of them into context.

## After

Read the summary back: what was created, what was skipped, what still needs
their hands (Linear team creation has no API — the script prints the URL and
records the key).

If a stage failed, say which and why. Do not silently retry it with tool calls.
Repeated failure is a `gather` item, not a puzzle to brute-force against
someone's live infrastructure.
