import { describe, expect, test } from "bun:test";
import {
  checkReview,
  intake,
  type Job,
  parseReview,
  validateDiff,
  validateManifest,
} from "../agent/lib/contract.js";

const commit = "a".repeat(40);
const commands = [
  ["bun", "test"],
  ["bun", "run", "build"],
];
const report = () => ({
  commit,
  approved: true,
  unchanged: true,
  findings: [],
  checks: commands.map((command) => ({ command, exitCode: 0, evidence: "passed independently" })),
  criteria: [{ step: "J1.S1", passed: true, evidence: "verified empty state" }],
});
const job: Job = {
  id: "A",
  title: "A",
  instructions: "Implement A",
  steps: ["J1.S1"],
  dependsOn: [],
  paths: ["apps/web/src/features/returns"],
  checks: commands,
  requiresBrowser: false,
};
const manifest = () => ({
  version: 1,
  id: "test",
  base: commit,
  approval: "approved",
  verification: "cursor-cloud",
  specFiles: ["docs/spec.md"],
  coverageFile: "docs/spec.md",
  setup: [],
  worker: { kind: "cursor", repository: "https://github.com/acme/product" },
  limits: { attempts: 2, jobSeconds: 600, runSeconds: 3600 },
  jobs: [job],
  combinedChecks: commands,
});

describe("acceptance is an exact contract", () => {
  test("allows command order changes without weakening coverage", () => {
    const r = report();
    r.checks.reverse();
    expect(checkReview(r, commit, commands, ["J1.S1"]).approved).toBe(true);
  });
  for (const defect of [
    "missing-check",
    "duplicate-check",
    "wrong-commit",
    "failed-check",
    "missing-criterion",
    "changed-tree",
    "blank-evidence",
  ]) {
    test(`rejects ${defect} despite approved=true`, () => {
      const r = report();
      if (defect === "missing-check") r.checks.pop();
      if (defect === "duplicate-check") r.checks[1] = r.checks[0];
      if (defect === "wrong-commit") r.commit = "b".repeat(40);
      if (defect === "failed-check") r.checks[0].exitCode = 1;
      if (defect === "missing-criterion") r.criteria = [];
      if (defect === "changed-tree") r.unchanged = false;
      if (defect === "blank-evidence") r.checks[0].evidence = "   ";
      expect(() => checkReview(r, commit, commands, ["J1.S1"])).toThrow();
    });
  }
  test("informational findings do not veto a passing approve", () => {
    const r = report();
    (r.findings as string[]).push("NON-BLOCKING: Task B left for the next job");
    expect(checkReview(r, commit, commands, ["J1.S1"]).approved).toBe(true);
    expect(parseReview(r, commit, commands, ["J1.S1"]).review.findings).toEqual([]);
  });
});
describe("scope and graph guards", () => {
  test("rename cannot move an out-of-scope file into allowed directory", () => {
    expect(() =>
      validateDiff(
        [{ filename: `${job.paths[0]}/safe.ts`, previous_filename: "packages/db/schema.ts" }],
        job,
        [],
      ),
    ).toThrow();
  });
  test("prefix sibling and pinned test edits are rejected", () => {
    for (const filename of [`${job.paths[0]}-other/a.ts`, `${job.paths[0]}/test.ts`]) {
      expect(() => validateDiff([{ filename }], job, [`${job.paths[0]}/test.ts`])).toThrow();
    }
  });
  test("rejects dependency cycles, missing dependencies and duplicate IDs", () => {
    for (const jobs of [
      [{ ...job, dependsOn: ["A"] }],
      [{ ...job, dependsOn: ["missing"] }],
      [job, job],
    ]) {
      expect(() => validateManifest({ ...manifest(), jobs }, "acme/product")).toThrow();
    }
  });
  test("rejects repository mismatch, traversal, and missing browser checks", () => {
    expect(() => validateManifest(manifest(), "acme/other")).toThrow();
    expect(() =>
      validateManifest({ ...manifest(), specFiles: ["../secret"] }, "acme/product"),
    ).toThrow();
    expect(() =>
      validateManifest(
        { ...manifest(), jobs: [{ ...job, requiresBrowser: true }] },
        "acme/product",
      ),
    ).toThrow();
  });
  test("approve may include extra keys, a short SHA, and a string command", () => {
    const r = {
      ...report(),
      commit: commit.slice(0, 12),
      notes: "non-blocking scope note",
      checks: [{ command: "bun test", exitCode: 0, evidence: "passed independently" }],
    };
    expect(parseReview(r, commit, [["bun", "test"]], ["J1.S1"]).verdict).toBe("approve");
  });
  test("approve may map or drop extra criterion IDs when required steps passed", () => {
    const r = report();
    r.criteria.push({ step: "invented", passed: true, evidence: "no" });
    expect(parseReview(r, commit, commands, ["J1.S1"]).verdict).toBe("approve");
  });
  test("approve may include extra checks if every required command ran", () => {
    const r = report();
    r.checks.push({ command: ["bun", "run", "lint"], exitCode: 0, evidence: "extra pass" });
    expect(checkReview(r, commit, commands, ["J1.S1"]).approved).toBe(true);
  });
  test("omitted required check names the missing argv", () => {
    const r = report();
    r.checks.pop();
    expect(() => parseReview(r, commit, commands, ["J1.S1"])).toThrow("omitted checks");
    expect(() => parseReview(r, commit, commands, ["J1.S1"])).toThrow("build");
  });
  test("request_changes is a structured verdict, not an approval", () => {
    const r = {
      ...report(),
      approved: undefined,
      verdict: "request_changes" as const,
      findings: ["empty state missing"],
    };
    delete (r as { approved?: boolean }).approved;
    expect(parseReview(r, commit, commands, ["J1.S1"]).verdict).toBe("request_changes");
    expect(() => checkReview(r, commit, commands, ["J1.S1"])).toThrow();
  });
  test("intake requires one immutable commit and manifest", () => {
    const block =
      "```factory-batch\n" + JSON.stringify({ commit, manifest: "docs/batch.json" }) + "\n```";
    expect(intake(block).commit).toBe(commit);
    expect(() => intake(block + block)).toThrow();
    expect(() => intake(block.replace(commit, "main"))).toThrow();
  });
});
