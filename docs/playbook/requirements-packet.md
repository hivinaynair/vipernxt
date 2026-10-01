# Requirements packet and unattended handoff

The human-readable review links the domain model, field inventories, rules, access matrix and operating contracts. `docs/product/requirements.json` indexes those same contracts for the factory. It adds no alternative business rules. Use [requirements-readiness](../../.agents/skills/shape/requirements-readiness.md) to discover the content; the structural checker cannot establish that the content is correct or exhaustive.

Before the final requirements approval, draft the ontology, journey criteria, coverage and cases needed to name the exact scope. Drafting these artifacts is permitted during shape; implementation remains gated. Resolve policy gaps with the customer, walk ordinary/incomplete/exception cases, and run the omission review. A technical plan may be refined within the approved contract afterwards. Do not copy an old approval onto a changed packet.

The packet is JSON with these required fields:

| Field | Contract |
|---|---|
| `version`, `scope`, `approval` | `1`, `first-slice` or `mvp`, recorded decision ID matching manifest/catalog |
| `stateFile`, `coverageFile` | Safe repository paths, pinned in `specFiles` |
| `artifacts` | `{path, sha256}` for authoritative contracts, spine, coverage and case sources. SHA-256 covers exact UTF-8 bytes. Exclude the packet and state file to avoid circular hashes. |
| `areas` | Exactly one row for each of the thirteen IDs below. Applicable: `{id, applies:true, refs:[{path,locator}]}`. Inapplicable: `{id, applies:false, reason}`. Locators are exact section/field text present in a hashed artifact. |
| `requirements` | Every coverage ID exactly once: `{id, refs:[{path,locator}], cases:[caseId]}`. |
| `cases` | `{id, kind, actor, preconditions, input, trigger, expected:[assertion], requirements:[coverageId]}`. References must agree in both directions. Assertions specify the observable outcome, persisted result and prohibited side effects where applicable. |
| `findings` | `{id, summary, owner, material, status, requirements:[id], decision?}`. Material open findings block. Resolved findings need a recorded resolution. Excluded behavior must leave approved coverage first. |
| `assumptions` | `{id, requirements:[id], consequence, recheck, decision}`. Domain assumptions need explicit recorded acceptance. |
| `walkthrough` | `{person, date, evidence, provenance:"observed", cases:[id]}`. Must include ordinary, incomplete and exception cases. Synthetic fixtures cannot authorize hosted implementation. |

Area IDs: `outcome`, `access`, `journeys`, `entities`, `surfaces`, `rules`, `integrations`, `files`, `accessibility`, `data-handling`, `operations`, `rollout`, `model-judgment`. Additional case kinds: `boundary`, `denial`, `retry`, `conflict`, `failure`. Add these wherever the behavior requires them. Field inventories must cover forms, filters, imports, edits, tables, detail/report outputs and derived information; entities must define identity, types, cardinality, ownership, invariants and lifecycle. A reference that exists does not prove these semantic obligations.

Finish the packet, then record the user's actual answer in state with the exact packet hash:

```yaml
decisions:
  - id: H_FACTORY
    answer: "<user's actual approval, naming scope and permitted actions>"
    requirements:
      file: docs/product/requirements.json
      sha256: <SHA-256 of the exact packet bytes>
      scope: mvp
      actions: [build, staging]
```

Use `build` alone for build/review delivery. Include `staging` only when approved. Open held items block unless they are explicitly nonmaterial or name only requirements outside this scope; answered/resolved/closed/done items do not block. Findings and assumptions remain visible after approval. The decision is append-only: changed contracts require a new packet and decision, not an edited historical answer. One final approval can include design, scoped requirements and unattended delivery; no approval is needed between technical stations. Existing first-clip acceptance remains a separate acceptance of working behavior.

Run `bun run check-requirements docs/product/requirements.json`. Hash with `sha256sum` or `contentHash` from `scripts/lib/requirements-readiness.ts`; preserve line endings and the final newline. The root checker on a bare kit reports that no engagement exists. That is not a readiness claim. Both real local runs and hosted registration require the packet. Local runs with explicit `simulation:true` retain their synthetic test bypass.

Add `requirementsFile` to the manifest, plus the packet, state, all contract/reference files, coverage, runtime controls and evaluators to `specFiles`. Hosted registration loads these files at the immutable intake SHA and validates the packet before reserving a worker. Older manifests/checkpoints fail closed and need a newly approved intake. There is no migration that silently certifies old requirements.

Limits: this gate detects stale hashes, missing applicability decisions, broken traces, incomplete walkthrough kinds, unaccepted assumptions, material held items and approval/action mismatches. It does not authenticate an interview, infer omitted business rules or prove accessibility, security, performance or deployed behavior. Those claims need customer review and the pinned behavioral checks.
