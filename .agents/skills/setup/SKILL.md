---
name: setup
description: Provision approved product services; distinguish configuration from verified deployment.
---

# setup

Follow [CONTRACT](../CONTRACT.md). Inputs: accepted slice, named clone, scaffold manifest and authorized targets. For cloud first-slice work, create/link only a dedicated GitHub repository early; never reuse the kit origin.

Factory credentials use root `bun run setup` and [START](../../../docs/START.md). Product provisioning is separate: read targets/script, then run `./.agents/skills/setup/setup.sh` after slice acceptance.

Scaffolded.yaml selects vendors; .env.playbook records names/regions/IDs. Keep secrets private. After uncertain creation, reconcile the receipt before retrying via any API.

Report created/skipped/failed/manual stages separately. Exit success does not prove deployment: verify remote identity, staging/protections, environment scopes, Vercel application root, runtime keys, migrations and deployed smoke journey. Return failures and independent next work to /next.

Auth uses pinned `bunx clerk@3.3.0`: login once; create/reuse and persist application ID; link/pull development keys. Existing CLERK_APP_ID reconciles an app; never delete an uncertain receipt or rerun clerk init over product code. [Cloud auth](../../../docs/kit/cloud-auth.md) covers test users, roles/runtime secrets; local setup does not prove cloud sign-in.
