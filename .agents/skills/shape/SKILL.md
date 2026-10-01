---
name: shape
description: Gather and reconcile product requirements, domain models, data surfaces and acceptance cases before implementation.
---

# shape

Follow [CONTRACT.md](../CONTRACT.md). Inputs: accepted brief, workflow evidence, salvage/research. Output: `docs/plans/<date>-<name>-design.md`, using [template](design-doc-template.md); ≤800-word overview plus linked structured detail.

1. Read state, AGENTS and recipe. Load [questions](questions.md) only for unresolved decisions.
2. Settle U5: person, outcome, problem, why the obvious implementation misses it, fallback. Evidence can answer multiple gates; label assumptions.
3. Identify actors, policy/data/money owners and non-users. Default one app with roles, not an app per actor.
4. Settle applicable auth, tenancy, permissions, persistence and navigation. Auth belongs in the first real journey; use [test identities](../../../docs/kit/cloud-auth.md).
5. Draft numbered clip beats and one journey row per seat: wants, does, first result, end result. Confirm unresolved story choices before screens.
6. Use [requirements readiness](requirements-readiness.md) and [data surfaces](data-surfaces.md): entities, fields/displays, rules, access, integrations, operations and acceptance. Walk ordinary, incomplete and exception records; cover empty/loading/error/recovery states. Headless work still needs data/behavior contracts.
7. Select recipe surfaces/facets with reasons; scaffold only after acceptance.
8. Draft faithful ontology/spine and exact-scope cases/coverage. Run an independent omission/contradiction review; resolve material findings. Record outstanding approval with decision ID and exact [packet hash/actions](../../../docs/playbook/requirements-packet.md), then return to /next.

Research primary sources for decision-changing unknowns; it does not prove customer behavior. Incumbent fields/menus are evidence, not mandatory scope. Distinguish habit, domain obligation and assumptions.

A design doc is sufficient. Use a disposable visual only to resolve a material question, outside gated product paths. Revisions touch affected story/contracts only. No vendor provisioning, package renaming or product UI during shape.
