# Acceptance that exposes missing requirements

Give each case a stable ID. Record actor/tenant, preconditions and representative input, trigger, expected visible result, persisted state and side effects, plus what must not happen. Link exact field/rule/action IDs and the design beat or spine criterion. Case definitions belong beside the eval set or in a linked `docs/product/acceptance-cases.md`; implementation tests cite them and the spine IDs. Preserve observed cases; label synthetic extensions separately.

For each applicable rule, exercise success and rejection, absent/unknown versus empty versus zero, range boundaries and permitted states. Add permission denial, duplicate/retry, concurrent update and external failure where those operations exist. Cover transaction rollback or permitted partial completion. Verify resulting records, not only messages or disabled controls. Shared rules can reuse cases when each consumer's enforcement is actually exercised.

Example below is synthetic, not a policy recommendation. Assumed policy for this example: a billing operator may save draft invoices in their own tenant; currency must be INR, amount positive with at most two decimal places, identical request IDs repeat the original result, and stale versions are rejected. Storage failure rolls back the save. Real products need evidence or an accepted decision for those choices.

| Case | Preconditions / action | Required result | Contract link |
|---|---|---|---|
| AC1 | Own-tenant draft, operator saves 100.25 INR; repeat with boundary 0.01 INR | One saved invoice per new request; amount/currency preserved; success receipt | Invoice.amount, Invoice.save |
| AC2a | Same actor submits 100.25 with missing currency | Currency error; entered amount preserved; no saved invoice | Invoice.currency |
| AC2b | Same actor submits 0 INR, then -0.01 INR | Amount error for each; entered values preserved; no saved invoice | Invoice.amount |
| AC2c | Same actor submits 0.001 INR | Precision error; no silent rounding or saved invoice | Invoice.amount |
| AC3 | Another tenant submits the same save directly | Denied at server; no write or record disclosure | Access.Invoice.write |
| AC4 | Same approved request retried after response loss | Same outcome; one invoice; no repeated side effect | Invoice.save.repeatability |
| AC5 | Two editors save against the same version | Approved conflict policy; no silent overwritten update | Invoice.save.conflict |
| AC6 | Persistence fails during submission | No false success; approved rollback/recovery; sensitive data absent from error | Invoice.save.failure |

These are distinct criteria when they make distinct promises; do not hide them under “save works”. Put observable behaviors in the spine and reconcile every exact criterion into the coverage catalog. Supporting matrices and test cases add detail without replacing that catalog. Operating criteria need a load/environment and measurement method; accessibility criteria need the relevant interaction check, not just a screenshot.

Review from both directions: every approved commitment has a case and planned implementation; every planned field, action and side effect has an approved purpose. Walk a case across all contracts to find contradictions: optional input versus non-null storage, display status versus lifecycle, role versus endpoint authorization, integration retry versus duplicated effects, deletion versus retained history.

The last ten observed cases are the outcome baseline, not complete software coverage. Add deterministic edge/denial/recovery cases without presenting them as observed evidence. A case file with no executed assertion is a specification, not passing evidence. Acceptance ultimately attaches to the exact combined candidate and required deployed environment.
