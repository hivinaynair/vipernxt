---
name: setup
description: >-
  Provisions a new product's infrastructure — GitHub repo, Neon databases, Vercel
  project, Linear team — by running a staged script rather than a sequence of
  agent tool calls. Use when starting a new product from the boilerplate or when
  connections are missing.
---

# Provision the accepted product

Input: accepted local slice, named clone, scaffold manifest and authorized cloud targets. Follow [execution contract](../CONTRACT.md). Setup creates external resources; scaffolding creates local code.

For explicitly selected cloud implementation, create/link only the dedicated product GitHub repository before the first slice. Do not run full provisioning for that prerequisite; never reuse the inherited kit origin.

Read the script and verify the product remote/targets before running:

```sh
./.agents/skills/setup/setup.sh
```

`docs/kit/scaffolded.yaml` selects services; `.env.playbook` records PRODUCT, region and resource IDs. Missing local DB credentials do not justify provisioning before the slice review. Keep secrets out of tool output and commits. Do not recreate a resource through another API after an uncertain script result; reconcile its ID first.

The script creates/links some resources, but its exit code is **not deployment verification**. Report created, skipped, failed and manual stages separately. Verify product repository identity, staging branch/protections, environment scopes, Vercel app root/runtime variables and migration workflow configuration before release. Never report vendors connected merely because dependencies or tokens exist.

On failure, return the exact stage and missing action to `/next`. Continue only independent authorized work. Cloud deployment and its smoke journey require their own evidence; do not mark setup or factory delivery complete from an untested local environment.
