import { expect, test } from "bun:test";
import { digest, verificationCommands } from "../agent/lib/contract.js";
import {
  deployedJob,
  executionCommands,
  integratedJob,
  promptRequirements,
  tick,
} from "../agent/lib/engine.js";
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
          body:
            "```factory-batch\n" +
            JSON.stringify(source) +
            "\n```" +
            (state.batch?.deployment
              ? '\n```factory-deployment\n{"deploymentId":10,"statusId":20}\n```'
              : ""),
        } as T;
      if (path === "/deployments?environment=staging&per_page=1") return [{ id: 10 }] as T;
      if (path === "/deployments/10")
        return {
          id: 10,
          sha: candidate,
          environment: "staging",
          production_environment: false,
          creator: { login: "vercel[bot]" },
        } as T;
      if (path === "/deployments/10/statuses?per_page=1")
        return [
          {
            id: 20,
            state: "success",
            environment: "staging",
            environment_url: "https://staging.example.com",
            creator: { login: "vercel[bot]" },
          },
        ] as T;
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
  const enableDeployment = () => {
    const b = state.batch!;
    b.coverage!.deployed = {
      environment: "staging",
      origin: "https://staging.example.com",
      creator: "vercel[bot]",
      checks: [["bun", "run", "test:deployed"]],
    };
    b.deployment = {
      deploymentId: 10,
      statusId: 20,
      commit: candidate,
      url: "https://staging.example.com/",
      startedAt: Date.now(),
    };
    b.integratedReview = { commit: candidate, review: goodReview() };
    b.pr = "https://github.com/acme/product/pull/2";
    b.startedAt = 0; // Approval may arrive days after implementation.
  };
  const deployedReview = () => {
    const b = state.batch!;
    return {
      ...goodReview(),
      checks: executionCommands(b, deployedJob(b)).map((command) => ({
        command,
        exitCode: 0,
        evidence: "Observed deployed behavior",
      })),
    };
  };
  return {
    enableDeployment,
    deployedReview,
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

test("slice request_changes returns to the builder instead of blocking", async () => {
  const f = fixture();
  const b = f.state().batch!;
  b.accepted = [];
  b.manifest.limits.attempts = 3;
  b.candidate = "a".repeat(40);
  b.active = {
    agentId: "bc-review",
    phase: "review",
    base: "b".repeat(40),
    candidate: "b".repeat(40),
    branch: "cursor/loan",
    startedAt: Date.now(),
    posted: true,
  };
  const job = b.manifest.jobs[0];
  f.setReview({
    commit: "b".repeat(40),
    verdict: "request_changes",
    unchanged: true,
    findings: ["empty state missing"],
    checks: verificationCommands(b.manifest, job).map((command) => ({
      command,
      exitCode: 1,
      evidence: "failed",
    })),
    criteria: [{ step: "loan-created", passed: false, evidence: "missing row" }],
  });
  await tick(f.deps);
  expect(f.state().batch!.status).toBe("running");
  expect(f.state().batch!.feedback).toContain("empty state");
  expect(f.state().batch!.active).toBeUndefined();
  expect(f.state().batch!.revisions?.loan).toBe(1);
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

test("deployed review reserves a new run without rebuilding or merging", async () => {
  const f = fixture();
  f.enableDeployment();
  await tick(f.deps);
  expect(f.state().batch!.active?.phase).toBe("deployed-review");
  expect(f.prs()).toBe(0);
});
test("only actual deployed acceptance permits MVP completion", async () => {
  const f = fixture();
  f.enableDeployment();
  f.startReview();
  f.state().batch!.active!.phase = "deployed-review";
  f.setReview(f.deployedReview());
  await tick(f.deps);
  expect(f.state().batch!.status).toBe("mvp-complete");
  expect(f.state().batch!.deployedReview!.url).toBe("https://staging.example.com/");
  expect(f.prs()).toBe(0);
});
test("local-only commands cannot pass as deployed checks", async () => {
  const f = fixture();
  f.enableDeployment();
  f.startReview();
  f.state().batch!.active!.phase = "deployed-review";
  f.setReview(f.goodReview());
  await tick(f.deps);
  expect(f.state().batch!.status).toBe("blocked");
});
test("deployment acceptance has its own bounded clock that cannot reset", async () => {
  const f = fixture();
  f.enableDeployment();
  f.state().batch!.deployment!.startedAt = 0;
  await tick(f.deps);
  expect(f.state().batch!.status).toBe("blocked");
});
test("revoked deployment success blocks an otherwise passing review", async () => {
  const f = fixture();
  f.enableDeployment();
  f.startReview();
  f.state().batch!.active!.phase = "deployed-review";
  f.setReview(f.deployedReview());
  const github = f.deps.github;
  f.deps.github = async <T>(path: string, method?: string) =>
    path.includes("/statuses?") ? ([{ id: 21, state: "inactive" }] as T) : github<T>(path, method);
  await tick(f.deps);
  expect(f.state().batch!.status).toBe("blocked");
});
test("first-slice deployed acceptance cannot claim MVP completion", async () => {
  const f = fixture();
  f.enableDeployment();
  f.startReview();
  f.state().batch!.coverage!.scope = "first-slice";
  f.state().batch!.active!.phase = "deployed-review";
  f.setReview(f.deployedReview());
  await tick(f.deps);
  expect(f.state().batch!.status).toBe("slice-complete");
});
test("deployment is rechecked after the reviewer finishes", async () => {
  const f = fixture();
  f.enableDeployment();
  f.startReview();
  f.state().batch!.active!.phase = "deployed-review";
  f.setReview(f.deployedReview());
  let statusReads = 0;
  const github = f.deps.github;
  f.deps.github = async <T>(path: string, method?: string) => {
    if (path.includes("/statuses?") && ++statusReads > 1)
      return [{ id: 21, state: "inactive" }] as T;
    return github<T>(path, method);
  };
  await tick(f.deps);
  expect(statusReads).toBe(2);
  expect(f.state().batch!.status).toBe("blocked");
  expect(f.state().batch!.deployedReview).toBeUndefined();
});

test("slice review request_changes returns the builder twice then holds", async () => {
  const f = fixture();
  const b = f.state().batch!;
  b.accepted = [];
  b.candidate = "a".repeat(40);
  const job = b.manifest.jobs[0];
  const request = {
    commit: "b".repeat(40),
    verdict: "request_changes" as const,
    unchanged: true,
    findings: ["empty state missing"],
    checks: verificationCommands(b.manifest, job).map((command) => ({
      command,
      exitCode: 0,
      evidence: "ran",
    })),
    criteria: [{ step: "loan-created", passed: false, evidence: "missing empty state" }],
  };
  f.setReview(request);
  b.active = {
    agentId: "bc-review",
    phase: "review",
    base: "b".repeat(40),
    candidate: "b".repeat(40),
    branch: "cursor/loan",
    startedAt: Date.now(),
    posted: true,
  };
  await tick(f.deps);
  expect(f.state().batch!.status).toBe("running");
  expect(f.state().batch!.revisions?.loan).toBe(1);
  expect(f.state().batch!.active).toBeUndefined();
  await tick(f.deps);
  expect(f.state().batch!.active?.phase).toBe("build");
  f.state().batch!.active = {
    agentId: "bc-review",
    phase: "review",
    base: "b".repeat(40),
    candidate: "b".repeat(40),
    branch: "cursor/loan",
    startedAt: Date.now(),
    posted: true,
  };
  await tick(f.deps);
  expect(f.state().batch!.revisions?.loan).toBe(2);
  f.state().batch!.active = {
    agentId: "bc-review",
    phase: "review",
    base: "b".repeat(40),
    candidate: "b".repeat(40),
    branch: "cursor/loan",
    startedAt: Date.now(),
    posted: true,
  };
  await tick(f.deps);
  expect(f.state().batch!.status).toBe("blocked");
  expect(f.state().batch!.error).toContain("Review revision limit reached");
});

test("deadline wake still accepts a finished Cursor run", async () => {
  const f = fixture();
  const b = f.state().batch!;
  b.accepted = [];
  b.candidate = "a".repeat(40);
  b.active = {
    agentId: "bc-review",
    phase: "build",
    base: "a".repeat(40),
    startedAt: 0,
    posted: true,
    startingRef: "factory/input/bc-review",
  };
  const github = f.deps.github;
  f.deps.github = async <T>(path: string, method?: string) => {
    if (path.startsWith("/compare/"))
      return {
        status: "ahead",
        files: [{ filename: "apps/web/src/features/returns/domain.ts" }],
      } as T;
    if (path.startsWith("/git/refs")) return {} as T;
    return github<T>(path, method);
  };
  f.deps.head = async (ref: string) => (ref === "staging" ? "a".repeat(40) : "b".repeat(40));
  f.deps.advanceRemote = async () => ({
    id: "run-1",
    agentId: "bc-review",
    status: "FINISHED",
    git: {
      branches: [{ repoUrl: "https://github.com/acme/product.git", branch: "cursor/select" }],
    },
  });
  await tick(f.deps);
  expect(f.state().batch!.status).toBe("running");
  expect(f.state().batch!.active?.phase).toBe("review");
  expect(f.state().batch!.active?.branch).toBe("cursor/select");
});

test("expired batch clock still accepts a finished posted run", async () => {
  const f = fixture();
  const b = f.state().batch!;
  b.startedAt = 0;
  b.accepted = [];
  b.candidate = "a".repeat(40);
  b.active = {
    agentId: "bc-review",
    phase: "build",
    base: "a".repeat(40),
    startedAt: Date.now(),
    posted: true,
    startingRef: "factory/input/bc-review",
  };
  const github = f.deps.github;
  f.deps.github = async <T>(path: string, method?: string) => {
    if (path.startsWith("/compare/"))
      return {
        status: "ahead",
        files: [{ filename: "apps/web/src/features/returns/domain.ts" }],
      } as T;
    if (path.startsWith("/git/refs")) return {} as T;
    return github<T>(path, method);
  };
  f.deps.head = async (ref: string) => (ref === "staging" ? "a".repeat(40) : "b".repeat(40));
  f.deps.advanceRemote = async () => ({
    id: "run-1",
    agentId: "bc-review",
    status: "FINISHED",
    git: {
      branches: [{ repoUrl: "https://github.com/acme/product.git", branch: "cursor/select" }],
    },
  });
  await tick(f.deps);
  expect(f.state().batch!.status).toBe("running");
  expect(f.state().batch!.active?.phase).toBe("review");
});

test("unreadable slice review returns to the builder once", async () => {
  const f = fixture();
  const b = f.state().batch!;
  b.accepted = [];
  f.setReview({ commit: "b".repeat(40), verdict: "approve", findings: [{ message: "x" }] });
  b.active = {
    agentId: "bc-review",
    phase: "review",
    base: "b".repeat(40),
    candidate: "b".repeat(40),
    branch: "cursor/loan",
    startedAt: Date.now(),
    posted: true,
  };
  await tick(f.deps);
  expect(f.state().batch!.status).toBe("running");
  expect(f.state().batch!.revisions?.loan).toBe(1);
  expect(f.state().batch!.active).toBeUndefined();
  expect(f.state().batch!.feedback).toBeTruthy();
});

test("slice review reject holds without another builder turn", async () => {
  const f = fixture();
  const b = f.state().batch!;
  b.accepted = [];
  const job = b.manifest.jobs[0];
  f.setReview({
    commit: "b".repeat(40),
    verdict: "reject",
    unchanged: true,
    findings: ["wrong entity"],
    checks: verificationCommands(b.manifest, job).map((command) => ({
      command,
      exitCode: 0,
      evidence: "ran",
    })),
    criteria: [{ step: "loan-created", passed: false, evidence: "wrong entity" }],
  });
  b.active = {
    agentId: "bc-review",
    phase: "review",
    base: "b".repeat(40),
    candidate: "b".repeat(40),
    branch: "cursor/loan",
    startedAt: Date.now(),
    posted: true,
  };
  await tick(f.deps);
  expect(f.state().batch!.status).toBe("blocked");
  expect(f.state().batch!.error).toContain("reject");
  expect(f.state().batch!.accepted).toEqual([]);
});
