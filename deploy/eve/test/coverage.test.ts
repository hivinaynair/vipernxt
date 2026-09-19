import { expect, test } from "bun:test";
import { validateManifest } from "../agent/lib/contract.js";
import { validateCoverage } from "../agent/lib/coverage.js";

const spine = {
  journeys: [
    {
      steps: [
        { id: "J1.S1", criteria: ["Sign in"] },
        { id: "J1.S2", criteria: ["Create loan"] },
      ],
    },
  ],
};
const check = (c: unknown, m: ReturnType<typeof manifest>) => validateCoverage(c, m, spine);
const base = "a".repeat(40);
const manifest = () =>
  validateManifest(
    {
      version: 1,
      id: "mvp",
      base,
      approval: "approved",
      verification: "cursor-cloud",
      specFiles: ["docs/coverage.json", "docs/evidence.md", "docs/spine.yaml"],
      coverageFile: "docs/coverage.json",
      setup: [],
      worker: { kind: "cursor", repository: "https://github.com/acme/product" },
      limits: { attempts: 1, jobSeconds: 600, runSeconds: 3600 },
      jobs: [
        {
          id: "auth",
          title: "Auth",
          instructions: "Auth",
          steps: ["J1.S1"],
          dependsOn: [],
          paths: ["apps"],
          checks: [["bun", "test"]],
          requiresBrowser: false,
        },
        {
          id: "loan",
          title: "Loan",
          instructions: "Loan",
          steps: ["J1.S2"],
          dependsOn: ["auth"],
          paths: ["apps"],
          checks: [["bun", "test"]],
          requiresBrowser: false,
        },
      ],
      combinedChecks: [["bun", "test"]],
    },
    "acme/product",
  );
const catalog = () => ({
  version: 1,
  approval: "design-1",
  scope: "mvp",
  spineFile: "docs/spine.yaml",
  exclusions: [],
  foundations: Object.fromEntries(
    ["authentication", "tenancy", "authorization", "persistence"].map((name) => [
      name,
      { applies: false, reason: "Synthetic fixture" },
    ]),
  ),
  integrated: { checks: [["bun", "test"]] },
  requirements: [
    {
      id: "identity",
      step: "J1.S1",
      criterion: "Sign in",
      dependsOn: [],
      delivery: { kind: "job", job: "auth" },
    },
    {
      id: "create-loan",
      step: "J1.S2",
      criterion: "Create loan",
      dependsOn: ["identity"],
      delivery: { kind: "job", job: "loan" },
    },
  ],
});
test("complete planned MVP with authentication prerequisite passes", () => {
  expect(check(catalog(), manifest()).requirements).toHaveLength(2);
});
test("omitting a slice cannot silently shrink the approved MVP", () => {
  const m = manifest();
  m.jobs.pop();
  expect(() => check(catalog(), m)).toThrow("Uncovered requirement");
});
test("feature cannot bypass its authentication prerequisite", () => {
  const m = manifest();
  m.jobs[1].dependsOn = [];
  expect(() => check(catalog(), m)).toThrow("Missing prerequisite ordering");
});
test("unapproved step cannot be smuggled into a job", () => {
  const m = manifest();
  m.jobs[1].steps.push("J9.S1");
  expect(() => check(catalog(), m)).toThrow("outside approved coverage");
});
test("unknown and cyclic requirement dependencies are rejected", () => {
  const c = catalog();
  c.requirements[0].dependsOn = ["missing"];
  expect(() => check(c, manifest())).toThrow("Unknown requirement");
  c.requirements[0].dependsOn = ["create-loan"];
  expect(() => check(c, manifest())).toThrow("cycle");
});
test("existing implementation needs evidence pinned at this base", () => {
  const m = manifest();
  m.jobs.shift();
  m.jobs[0].dependsOn = [];
  const c = catalog();
  const existing = {
    ...c,
    requirements: [
      {
        ...c.requirements[0],
        delivery: { kind: "existing", commit: base, evidence: "docs/evidence.md" },
      },
      c.requirements[1],
    ],
  };
  expect(check(existing, m).requirements).toHaveLength(2);
  existing.requirements[0].delivery = {
    kind: "existing",
    commit: "b".repeat(40),
    evidence: "docs/evidence.md",
  };
  expect(() => check(existing, m)).toThrow("pinned evidence");
});

test("omitting a criterion from both jobs and catalog fails against spine", () => {
  const c = catalog();
  c.requirements.pop();
  expect(() => check(c, manifest())).toThrow("Uncovered spine criterion");
});
test("first-slice exclusions are explicit and cannot masquerade as MVP", () => {
  const c = catalog();
  const removed = c.requirements.pop()!;
  const m = manifest();
  m.jobs.pop();
  const partial = {
    ...c,
    scope: "first-slice",
    exclusions: [{ step: removed.step, criterion: removed.criterion, reason: "Next slice" }],
  };
  expect(check(partial, m).scope).toBe("first-slice");
  expect(() => check({ ...partial, scope: "mvp" }, m)).toThrow("MVP cannot exclude");
});
test("foundation consumer cannot omit its declared access dependency", () => {
  const c = catalog();
  c.requirements[1].dependsOn = [];
  expect(() =>
    check(
      {
        ...c,
        foundations: {
          ...c.foundations,
          authentication: { applies: true, requirements: ["identity"], consumers: ["create-loan"] },
        },
      },
      manifest(),
    ),
  ).toThrow("Missing authentication prerequisite");
});
test("screen journeys cannot omit final browser verification", () => {
  const interactive = structuredClone(spine);
  Object.assign(interactive.journeys[0].steps[0], { screen: "sign-in" });
  expect(() => validateCoverage(catalog(), manifest(), interactive)).toThrow(
    "browser verification",
  );
});
test("unknown criterion and duplicate assignment fail even with valid step IDs", () => {
  const c = catalog();
  c.requirements[0].criterion = "Invented";
  expect(() => check(c, manifest())).toThrow("outside approved spine");
  const duplicate = catalog();
  duplicate.requirements.push({ ...duplicate.requirements[0], id: "duplicate" });
  expect(() => check(duplicate, manifest())).toThrow("Duplicate criterion assignment");
});
test("all cross-cutting applicability decisions are required", () => {
  const c = catalog();
  delete c.foundations.authentication;
  expect(() => check(c, manifest())).toThrow();
});
