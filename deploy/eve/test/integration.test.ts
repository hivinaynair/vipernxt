import { expect, test } from "bun:test";
import { digest, verificationCommands } from "../agent/lib/contract.js";
import { integratedJob, promptRequirements, tick } from "../agent/lib/engine.js";
import type { Batch, State } from "../agent/lib/store.js";

function fixture() {
  const base = "a".repeat(40),
    candidate = "b".repeat(40);
  const source = { commit: base, manifest: "docs/batch.json" };
  const batch: Batch = {
    issue: 1,
    intakeHash: digest(source),
    commit: base,
    manifestPath: source.manifest,
    startedAt: Date.now(),
    status: "running",
    candidate,
    accepted: ["loan"],
    attempts: {},
    evidence: [],
    resultBranch: "cursor/loan",
    manifest: {
      version: 1,
      id: "mvp",
      base,
      approval: "approved",
      verification: "cursor-cloud",
      specFiles: ["docs/coverage.json"],
      coverageFile: "docs/coverage.json",
      setup: [],
      worker: { kind: "cursor", repository: "https://github.com/acme/product" },
      limits: { attempts: 1, jobSeconds: 600, runSeconds: 3600 },
      jobs: [
        {
          id: "loan",
          title: "Loan",
          instructions: "Loan",
          steps: ["J1.S1"],
          dependsOn: [],
          paths: ["apps"],
          checks: [["bun", "test"]],
          requiresBrowser: false,
        },
      ],
      combinedChecks: [["bun", "test"]],
    },
    coverage: {
      version: 1,
      approval: "approved",
      scope: "mvp",
      spineFile: "docs/spine.yaml",
      exclusions: [],
      foundations: {},
      integrated: { checks: [["bun", "run", "test:journeys"]] },
      requirements: [
        {
          id: "loan-created",
          step: "J1.S1",
          criterion: "Loan persists",
          dependsOn: [],
          delivery: { kind: "job", job: "loan" },
        },
        {
          id: "existing-auth",
          step: "J0.S1",
          criterion: "Signed out denied",
          dependsOn: [],
          delivery: { kind: "existing", evidence: "docs/auth-proof.md" },
        },
      ],
    },
  };
  let state: State = { version: 1, batch };
  let revision = 0;
  let prs = 0;
  let review: unknown;
  const deps = {
    enabled: () => true,
    repository: () => "acme/product",
    required: () => "staging",
    readState: async () => ({ state: structuredClone(state), sha: String(revision) }),
    saveState: async (s: State, previous?: string) => {
      expect(previous).toBe(String(revision));
      state = structuredClone(s);
      return String(++revision);
    },
    head: async (branch: string) => (branch === "staging" ? base : candidate),
    github: async <T>(path: string, method?: string): Promise<T> => {
      if (path === "/issues/1")
        return {
          state: "open",
          labels: [{ name: "factory" }],
          body: "```factory-batch\n" + JSON.stringify(source) + "\n```",
        } as T;
      if (path.startsWith("/pulls?")) return [] as T;
      if (path === "/pulls" && method === "POST") {
        prs++;
        return { html_url: "https://github.com/acme/product/pull/2" } as T;
      }
      throw new Error(`Unexpected request ${path}`);
    },
    advanceRemote: async () => ({
      id: "run-1",
      agentId: "bc-review",
      status: "FINISHED",
      result: JSON.stringify(review),
    }),
  };
  const startReview = () => {
    state.batch!.active = {
      agentId: "bc-review",
      phase: "integrated-review",
      base: candidate,
      branch: "cursor/loan",
      startedAt: Date.now(),
      posted: true,
    };
  };
  const goodReview = () => ({
    commit: candidate,
    approved: true,
    unchanged: true,
    findings: [],
    checks: verificationCommands(batch.manifest, integratedJob(batch)).map((command) => ({
      command,
      exitCode: 0,
      evidence: "Observed pass",
    })),
    criteria: batch.coverage!.requirements.map((r) => ({
      step: r.id,
      passed: true,
      evidence: "Observed behavior",
    })),
  });
  return {
    deps,
    state: () => state,
    prs: () => prs,
    startReview,
    setReview: (r: unknown) => {
      review = r;
    },
    goodReview,
  };
}

test("all slice receipts reserve final review rather than creating a PR", async () => {
  const f = fixture();
  await tick(f.deps);
  expect(f.state().batch!.active?.phase).toBe("integrated-review");
  expect(f.prs()).toBe(0);
});
test("final review must include already implemented requirements", async () => {
  const f = fixture();
  f.startReview();
  const r = f.goodReview();
  r.criteria.pop();
  f.setReview(r);
  await tick(f.deps);
  expect(f.state().batch!.status).toBe("blocked");
  expect(f.prs()).toBe(0);
});
test("passing integrated review is persisted before draft PR creation", async () => {
  const f = fixture();
  f.startReview();
  f.setReview(f.goodReview());
  await tick(f.deps);
  expect(f.state().batch!.integratedReview?.commit).toBe("b".repeat(40));
  expect(f.prs()).toBe(0);
  await tick(f.deps);
  expect(f.prs()).toBe(1);
  expect(f.state().batch!.status).toBe("review");
});
test("failed integrated command blocks despite approving prose", async () => {
  const f = fixture();
  f.startReview();
  const r = f.goodReview();
  r.checks[0].exitCode = 1;
  f.setReview(r);
  await tick(f.deps);
  expect(f.state().batch!.status).toBe("blocked");
  expect(f.prs()).toBe(0);
});
test("changed candidate invalidates integrated receipt", async () => {
  const f = fixture();
  f.state().batch!.integratedReview = { commit: "c".repeat(40), review: f.goodReview() };
  await tick(f.deps);
  expect(f.state().batch!.active?.phase).toBe("integrated-review");
  expect(f.prs()).toBe(0);
});
test("legacy batch cannot dispatch without the new coverage contract", async () => {
  const f = fixture();
  delete f.state().batch!.coverage;
  await tick(f.deps);
  expect(f.state().batch!.status).toBe("blocked");
  expect(f.state().batch!.error).toContain("predates required coverage");
  expect(f.prs()).toBe(0);
});
test("final review cannot escape the original batch budget", async () => {
  const f = fixture();
  f.state().batch!.startedAt = 0;
  await tick(f.deps);
  expect(f.state().batch!.status).toBe("blocked");
  expect(f.state().batch!.error).toContain("Batch time budget exhausted");
  expect(f.prs()).toBe(0);
});

test("slice prompts carry assigned requirements and prerequisites, not the whole MVP", () => {
  const f = fixture();
  const b = f.state().batch!;
  const job = b.manifest.jobs[0];
  expect(promptRequirements(b, job).map((r) => r.id)).toEqual(["loan-created"]);
  b.coverage!.requirements[0].dependsOn = ["existing-auth"];
  expect(promptRequirements(b, job).map((r) => r.id)).toEqual(["loan-created", "existing-auth"]);
  f.startReview();
  expect(promptRequirements(b, integratedJob(b))).toHaveLength(2);
});
