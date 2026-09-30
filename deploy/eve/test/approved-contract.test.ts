import { expect, test } from "bun:test";
import { approvedContract } from "../agent/lib/approved-contract.js";
import { type Manifest, validateManifest } from "../agent/lib/contract.js";
import { contentHash, readinessAreas } from "../agent/lib/requirements-readiness.js";

function fixture() {
  const coverage = {
    version: 1,
    scope: "first-slice",
    approval: "SIM1",
    spineFile: "docs/spine.json",
    exclusions: [],
    foundations: Object.fromEntries(
      ["authentication", "authorization", "tenancy", "persistence", "navigation"].map((id) => [
        id,
        { applies: false, reason: "Bounded read-only command demonstration" },
      ]),
    ),
    requirements: [
      {
        id: "read",
        step: "J1.S1",
        criterion: "Reads approved data",
        dependsOn: [],
        delivery: { kind: "job", job: "read" },
      },
    ],
    integrated: { checks: [["bun", "test"]] },
  };
  const files: Record<string, string> = {
    "docs/spine.json": JSON.stringify({
      journeys: [{ steps: [{ id: "J1.S1", criteria: ["Reads approved data"] }] }],
    }),
    "docs/coverage.json": JSON.stringify(coverage),
    "docs/contract.md":
      "Read-only command contract, no forms or mutations; empty and unknown records are explicit outcomes.",
  };
  const packet = {
    version: 1,
    scope: "first-slice",
    approval: "SIM1",
    stateFile: "docs/state.json",
    coverageFile: "docs/coverage.json",
    artifacts: Object.entries(files).map(([path, text]) => ({ path, sha256: contentHash(text) })),
    areas: readinessAreas.map((id) => ({
      id,
      applies: true,
      refs: [{ path: "docs/contract.md", locator: "Read-only command contract" }],
    })),
    requirements: [
      {
        id: "read",
        refs: [{ path: "docs/contract.md", locator: "Read-only command contract" }],
        cases: ["ordinary", "incomplete", "exception"],
      },
    ],
    cases: ["ordinary", "incomplete", "exception"].map((kind) => ({
      id: kind,
      kind,
      actor: "SIMULATED operator",
      preconditions: "Local approved fixture",
      input: kind,
      trigger: "Read",
      expected: ["Explicit outcome without mutation"],
      requirements: ["read"],
    })),
    findings: [],
    assumptions: [],
    walkthrough: {
      person: "SIMULATED operator",
      date: "2026-09-30",
      evidence: "Synthetic regression",
      provenance: "simulation",
      cases: ["ordinary", "incomplete", "exception"],
    },
  };
  files["docs/readiness.json"] = JSON.stringify(packet);
  files["docs/state.json"] = JSON.stringify({
    held: [],
    decisions: [
      {
        id: "SIM1",
        answer: "Synthetic build approval",
        requirements: {
          file: "docs/readiness.json",
          scope: "first-slice",
          sha256: contentHash(files["docs/readiness.json"]),
          actions: ["build"],
        },
      },
    ],
  });
  const manifest: Manifest = validateManifest(
    {
      version: 1,
      id: "read",
      base: "a".repeat(40),
      approval: "SIM1",
      requirementsFile: "docs/readiness.json",
      coverageFile: "docs/coverage.json",
      specFiles: Object.keys(files),
      setup: [],
      verification: "cursor-cloud",
      worker: { kind: "cursor", repository: "https://github.com/simulation/product" },
      limits: { attempts: 2, jobSeconds: 60, runSeconds: 600 },
      combinedChecks: [["bun", "test"]],
      jobs: [
        {
          id: "read",
          title: "Read",
          instructions: "Read approved fixture",
          steps: ["J1.S1"],
          dependsOn: [],
          paths: ["src"],
          checks: [["bun", "test"]],
          requiresBrowser: false,
        },
      ],
    },
    "simulation/product",
  );
  const reads: string[] = [];
  const read = async (path: string, ref: string) => {
    expect(ref).toBe(manifest.base);
    reads.push(path);
    if (!(path in files)) throw new Error("Missing file");
    return { text: files[path] };
  };
  return { files, manifest, reads, read };
}

test("live shared intake cannot accept a synthetic walkthrough", async () => {
  const f = fixture();
  await expect(approvedContract(f.manifest, f.manifest.base, f.read)).rejects.toThrow("synthetic");
});
test("explicit offline intake resolves the full hash-bound contract from the immutable ref", async () => {
  const f = fixture();
  const result = await approvedContract(f.manifest, f.manifest.base, f.read, {
    allowSimulation: true,
  });
  expect(result.readiness.sha256).toBe(contentHash(f.files["docs/readiness.json"]));
  expect(f.reads).toEqual(f.manifest.specFiles);
  expect(result.coverage.requirements.map((r) => r.id)).toEqual(["read"]);
});
test("changed catalog and dropped job cannot shrink the approved packet", async () => {
  const f = fixture();
  const coverage = JSON.parse(f.files["docs/coverage.json"]);
  coverage.requirements = [];
  f.files["docs/coverage.json"] = JSON.stringify(coverage);
  await expect(
    approvedContract(f.manifest, f.manifest.base, f.read, { allowSimulation: true }),
  ).rejects.toThrow();
});

for (const stage of ["integrated", "deployed"] as const) {
  test(`intake holds an ambiguous pinned Bun evaluator in ${stage} acceptance`, async () => {
    const f = fixture();
    const path = "test/selection.eval.ts";
    f.manifest.specFiles.push(path);
    f.files[path] = "throw new Error('must run')";
    const coverage = JSON.parse(f.files["docs/coverage.json"]);
    if (stage === "integrated") coverage.integrated.checks = [["bun", "test", path]];
    else
      coverage.deployed = {
        environment: "staging",
        origin: "https://staging.example.com",
        creator: "github-actions[bot]",
        checks: [["bun", "test", path]],
      };
    f.files["docs/coverage.json"] = JSON.stringify(coverage);
    await expect(
      approvedContract(f.manifest, f.manifest.base, f.read, { allowSimulation: true }),
    ).rejects.toThrow(`explicit path: use ./${path}`);
  });
}
