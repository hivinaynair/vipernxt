# Approved MVP coverage

Eve blocks missing journey criteria, unordered prerequisites and delivery without
an independent integrated review. These checks establish coverage of the approved
spine; they cannot establish that discovery found every customer need.

Plan the whole approved MVP before handing it to unattended execution. Set the
manifest's `coverageFile` to a JSON catalog. Include that catalog, `spineFile`, data
surfaces and verification artifacts in `specFiles`; registration compares their
contents with the approved execution base. Workers cannot edit them. This version
supports one authoritative MVP spine file, not a multi-file spine collection;
consolidate the approved MVP journeys into that file before dispatch.

```json
{
  "version": 1,
  "approval": "design-decision-1",
  "scope": "mvp",
  "spineFile": "docs/journeys/product.yaml",
  "exclusions": [],
  "foundations": {
    "authentication": {"applies":true,"requirements":["sign-in"],"consumers":["create-loan"]},
    "tenancy": {"applies":false,"reason":"Single organization deployment"},
    "authorization": {"applies":true,"requirements":["sign-in"],"consumers":["create-loan"]},
    "persistence": {"applies":true,"requirements":["create-loan"],"consumers":["create-loan"]}
  },
  "requirements": [
    {"id":"sign-in","step":"J1.S1","criterion":"WHEN staff signs in THE SYSTEM SHALL open their workspace","dependsOn":[],"delivery":{"kind":"job","job":"identity"}},
    {"id":"create-loan","step":"J1.S2","criterion":"WHEN staff records a loan THE SYSTEM SHALL persist it","dependsOn":["sign-in"],"delivery":{"kind":"job","job":"loans"}}
  ],
  "integrated": {
    "checks": [["bun","run","test:journeys"]],
    "browser": ["bun","run","e2e"]
  }
}
```

Each `criterion` must exactly match one criterion under its step in the pinned
YAML spine. Every spine criterion must appear exactly once as a requirement or
exclusion. Each requirement has a stable catalog ID; independent reviewers return
evidence against these IDs, so multiple criteria on one step cannot collapse into
one passing step report. Unknown criteria, duplicate assignments, dependency cycles
and missing jobs block dispatch.

The assigned job must cite the step and depend transitively on prerequisite jobs.
A coherent slice may implement a requirement and its prerequisite together.
Existing behavior uses `delivery: {"kind":"existing","evidence":"docs/evidence.md"}`.
Pin the evidence file as historical supporting material. It does not certify the
execution base, and must not embed that containing commit's own SHA (which would
be circular). Final integrated review independently re-verifies existing behavior
at the actual final candidate. A historical report or declaration is not acceptance.

All four foundation decisions are required. Applicable foundations name requirement
IDs and every consumer; each consumer must explicitly depend on those requirements.
Decide sign-in, organization ownership, roles and persistence before splitting work.
Schema, route shells and test accounts precede their consumers. The first useful
journey exercises real access rules. Later access-model changes require rechecking
all affected journeys, including signed-out, forbidden and cross-tenant cases.

A `first-slice` batch may explicitly exclude criteria using `{step, criterion,
reason}`. An `mvp` batch cannot exclude approved spine criteria. Deferred work must
first be removed from the approved MVP spine through a scope decision. Neither
omitting a job nor editing only the catalog can silently reduce MVP coverage.

After all slice reviews pass, a fresh Cursor verifier checks the final candidate
against **all** catalog requirements, including existing behavior, integrated
commands and combined checks. Interactive journeys require a browser command.
A failed or incomplete report blocks delivery; a passing receipt is persisted before
opening a draft PR. Stage/batch deadlines and attempt limits also bound this review.
This verifies the combined candidate in the worker environment, not a production
or staging deployment. Deployment acceptance remains separate. Hosted end-to-end
Eve execution is still unverified; the contract is covered by local tests.
