import { expect, test } from "bun:test";
import {
  contentHash,
  type ReadinessContext,
  readinessAreas,
  validateReadiness,
} from "../../../scripts/lib/requirements-readiness.js";

function fixture() {
  const contract =
    "## Loan contract\nAmount is positive, at most two decimal places. Missing amount rejects without writes. Duplicate submission returns original receipt.\nObserved walkthrough with Maya, 2026-09-30.";
  const packet = {
    coverageFile: "docs/coverage.json",
    version: 1,
    scope: "mvp",
    approval: "H1",
    stateFile: "docs/state.yaml",
    artifacts: [{ path: "docs/model.md", sha256: contentHash(contract) }],
    areas: readinessAreas.map((id) => ({
      id,
      applies: true,
      refs: [{ path: "docs/model.md", locator: "Loan contract" }],
    })),
    requirements: [
      {
        id: "create-loan",
        refs: [{ path: "docs/model.md", locator: "Loan contract" }],
        cases: ["C1", "C2", "C3"],
      },
    ],
    cases: ["ordinary", "incomplete", "exception"].map((kind, n) => ({
      id: `C${n + 1}`,
      kind,
      actor: "Maya",
      preconditions: "Signed in; own tenant",
      input: "Case-specific amount",
      trigger: "Submit",
      expected: ["Case-specific persisted result and prohibited writes"],
      requirements: ["create-loan"],
    })),
    findings: [] as Record<string, unknown>[],
    assumptions: [] as Record<string, unknown>[],
    walkthrough: {
      person: "Maya",
      date: "2026-09-30",
      evidence: "Observed cases recorded in model",
      provenance: "observed",
      cases: ["C1", "C2", "C3"],
    },
  };
  const state = {
    decisions: [
      {
        id: "H1",
        answer: "Approve this MVP and staging delivery",
        requirements: {
          file: "docs/readiness.json",
          scope: "mvp",
          sha256: "",
          actions: ["build", "staging"],
        },
      },
    ],
    held: [] as Record<string, unknown>[],
  };
  const check = (bind = true, coverageFile?: string) => {
    const packetText = JSON.stringify(packet);
    if (bind) state.decisions[0].requirements.sha256 = contentHash(packetText);
    const ctx: ReadinessContext = {
      coverageFile,
      file: "docs/readiness.json",
      packetText,
      approval: "H1",
      scope: "mvp",
      specFiles: ["docs/readiness.json", "docs/model.md", "docs/state.yaml"],
      files: {
        "docs/readiness.json": packetText,
        "docs/model.md": contract,
        "docs/state.yaml": "state",
      },
      state,
      requirementIds: ["create-loan"],
      staging: true,
    };
    return validateReadiness(ctx);
  };
  return { packet, state, check };
}
test("exact packet approval accepts a traced observed walkthrough", () =>
  expect(fixture().check().scope).toBe("mvp"));
test("changing an acceptance rule invalidates existing approval", () => {
  const f = fixture();
  f.check();
  f.packet.cases[0].expected = ["Changed rule"];
  expect(() => f.check(false)).toThrow("exact packet");
});
for (const defect of [
  "missing-area",
  "stale-contract",
  "missing-section",
  "orphan-case",
  "missing-exception",
  "synthetic",
  "material-finding",
  "unaccepted-assumption",
  "held",
  "missing-staging-authorization",
  "duplicate-id",
  "scope",
]) {
  test(`blocks ${defect} before worker dispatch`, () => {
    const f = fixture();
    if (defect === "missing-area") f.packet.areas.pop();
    if (defect === "stale-contract") f.packet.artifacts[0].sha256 = "a".repeat(64);
    if (defect === "missing-section") f.packet.requirements[0].refs[0].locator = "invented";
    if (defect === "orphan-case") f.packet.cases[0].requirements = ["invented"];
    if (defect === "missing-exception") f.packet.walkthrough.cases.pop();
    if (defect === "synthetic") f.packet.walkthrough.provenance = "simulation";
    if (defect === "material-finding")
      f.packet.findings.push({
        id: "F1",
        summary: "Who may override?",
        owner: "Maya",
        requirements: ["create-loan"],
        material: true,
        status: "open",
      });
    if (defect === "unaccepted-assumption")
      f.packet.assumptions.push({
        id: "A1",
        requirements: ["create-loan"],
        consequence: "Wrong business policy",
        recheck: "Next visit",
        decision: "missing",
      });
    if (defect === "held")
      f.state.held.push({ id: "H2", status: "open", requirements: ["create-loan"] });
    if (defect === "missing-staging-authorization")
      f.state.decisions[0].requirements.actions = ["build"];
    if (defect === "duplicate-id") f.packet.cases.push(f.packet.cases[0]);
    if (defect === "scope") f.packet.scope = "first-slice";
    expect(() => f.check()).toThrow();
  });
}
test("resolved held decisions do not keep readiness blocked", () => {
  const f = fixture();
  f.state.held.push({ id: "H2", status: "answered" });
  expect(f.check().scope).toBe("mvp");
});
test("excluded findings remain visible only after affected behavior leaves approved coverage", () => {
  const f = fixture();
  f.packet.findings.push({
    id: "F1",
    summary: "Live import excluded",
    owner: "Maya",
    material: true,
    status: "excluded",
    requirements: ["future-live-import"],
    decision: "H1",
  });
  expect(f.check().scope).toBe("mvp");
  f.packet.findings[0].requirements = ["create-loan"];
  expect(() => f.check()).toThrow("retain in-scope");
});

test("another catalog cannot replace the packet's chosen coverage", () => {
  expect(() => fixture().check(true, "docs/unrelated-coverage.json")).toThrow(
    "coverage file differs",
  );
});

test("a material held item cannot bypass scope by leaving affected IDs empty", () => {
  const f = fixture();
  f.state.held.push({ id: "H2", status: "open", material: true, requirements: [] });
  expect(() => f.check()).toThrow("material held item");
});
