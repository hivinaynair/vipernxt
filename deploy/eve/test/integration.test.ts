import { expect, test } from "bun:test";
import { digest, verificationCommands } from "../agent/lib/contract.js";
import {
  deployedJob,
  executionCommands,
  integratedJob,
  promptRequirements,
  repairJob,
  tick,
} from "../agent/lib/engine.js";
import { GitHubError } from "../agent/lib/github.js";
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
    readiness: { sha256: "h", scope: "mvp", approval: "approved" },
    resultBranch: "cursor/loan",
    manifest: {
      version: 1,
      id: "mvp",
      base,
      approval: "approved",
      verification: "cursor-cloud",
      specFiles: ["docs/coverage.json"],
      coverageFile: "docs/coverage.json",
      requirementsFile: "docs/readiness.json",
      setup: [],
      worker: { kind: "cursor", repository: "https://github.com/acme/product" },
      limits: { attempts: 3, jobSeconds: 600, runSeconds: 3600 },
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
      if (path === "/git/refs" && method === "POST") return {} as T;
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

test("slice review asks for job commands, not the combined suite", () => {
  const f = fixture();
  const b = f.state().batch!;
  b.manifest.setup = [["bun", "install"]];
  b.manifest.combinedChecks = [["bun", "run", "build"]];
  const job = b.manifest.jobs[0];
  expect(executionCommands(b, job)).toEqual([["bun", "test"]]);
  expect(executionCommands(b, integratedJob(b))).toContainEqual(["bun", "run", "build"]);
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
    result: "",
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
    result: "",
    git: {
      branches: [{ repoUrl: "https://github.com/acme/product.git", branch: "cursor/select" }],
    },
  });
  await tick(f.deps);
  expect(f.state().batch!.status).toBe("running");
  expect(f.state().batch!.active?.phase).toBe("review");
});

test("unreadable slice review reserves only a new reviewer of the same candidate", async () => {
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
  expect(Object.values(f.state().batch!.unreadable!)).toEqual([1]);
  expect(f.state().batch!.revisions?.loan).toBeUndefined();
  expect(f.state().batch!.active?.phase).toBe("review");
  expect(f.state().batch!.active?.base).toBe(b.active!.base);
  expect(f.state().batch!.active?.startedAt).toBe(b.active!.startedAt);
  expect(f.state().batch!.active?.agentId).not.toBe("bc-review");
  expect(f.state().batch!.feedback).toBeTruthy();
});

test("builder ERROR returns to a new station instead of blocking", async () => {
  const f = fixture();
  const b = f.state().batch!;
  b.accepted = [];
  b.active = {
    agentId: "bc-build",
    phase: "build",
    base: "a".repeat(40),
    startedAt: Date.now(),
    posted: true,
    startingRef: "factory/input/bc-build",
  };
  f.deps.advanceRemote = async () => ({
    id: "run-1",
    agentId: "bc-build",
    status: "ERROR",
    result: "",
  });
  await tick(f.deps);
  expect(f.state().batch!.status).toBe("running");
  expect(f.state().batch!.active).toBeUndefined();
  expect(f.state().batch!.feedback).toContain("ERROR");
});

test("review ERROR returns to a new station instead of blocking", async () => {
  const f = fixture();
  const b = f.state().batch!;
  b.accepted = [];
  b.active = {
    agentId: "bc-review",
    phase: "review",
    base: "b".repeat(40),
    candidate: "b".repeat(40),
    branch: "cursor/loan",
    startedAt: Date.now(),
    posted: true,
  };
  f.deps.advanceRemote = async () => ({
    id: "run-2",
    agentId: "bc-review",
    status: "ERROR",
    result: "",
  });
  await tick(f.deps);
  expect(f.state().batch!.status).toBe("running");
  expect(f.state().batch!.active?.phase).toBe("review");
  expect(f.state().batch!.active?.agentId).not.toBe("bc-review");
  expect(f.state().batch!.feedback).toContain("ERROR");
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

test("review retry exhaustion holds the same candidate without a builder dispatch", async () => {
  const f = fixture();
  f.state().batch!.accepted = [];
  f.startReview();
  f.state().batch!.active!.phase = "review";
  f.setReview({ commit: "b".repeat(40), verdict: "approve" });
  const startedAt = f.state().batch!.active!.startedAt;
  const attempts = structuredClone(f.state().batch!.attempts);
  for (let n = 0; n < 3; n++) {
    f.state().batch!.active!.posted = true;
    await tick(f.deps);
  }
  expect(f.state().batch!.status).toBe("blocked");
  expect(f.state().batch!.error).toContain("Review retry budget exhausted");
  expect(f.state().batch!.active?.phase).toBe("review");
  expect(f.state().batch!.active?.startedAt).toBe(startedAt);
  expect(f.state().batch!.attempts).toEqual(attempts);
  expect(f.prs()).toBe(0);
});

test("legacy readiness and changed staging baseline hold before publication", async () => {
  for (const defect of ["readiness", "target-head"]) {
    const f = fixture();
    f.state().batch!.integratedReview = {
      commit: f.state().batch!.candidate,
      review: f.goodReview(),
    };
    if (defect === "readiness") f.state().batch!.readiness = undefined;
    else f.deps.head = async (branch) => (branch === "staging" ? "c".repeat(40) : "b".repeat(40));
    await tick(f.deps);
    expect(f.state().batch!.status).toBe("blocked");
    expect(f.state().batch!.error).toContain(
      defect === "readiness" ? "readiness gate" : "Target branch changed",
    );
    expect(f.prs()).toBe(0);
  }
});

test("transient provider failure retries the same identity with backoff and a fixed ceiling", async () => {
  const f = fixture();
  f.startReview();
  const id = f.state().batch!.active!.agentId;
  let reads = 0;
  f.deps.github = async (path) => {
    if (path === "/issues/1") reads++;
    throw new GitHubError(503, "GET issue");
  };
  await tick(f.deps);
  expect(f.state().batch!.status).toBe("running");
  expect(f.state().batch!.active!.agentId).toBe(id);
  expect(f.state().batch!.retryAfter).toBeGreaterThan(Date.now());
  await tick(f.deps);
  expect(reads).toBe(1);
  for (let n = 0; n < 3; n++) {
    f.state().batch!.retryAfter = 0;
    await tick(f.deps);
  }
  expect(f.state().batch!.status).toBe("blocked");
  expect(f.state().batch!.networkRetries?.[id]).toBe(3);
});

test("authorization failures never become automatic network retries", async () => {
  const f = fixture();
  f.deps.github = async () => {
    throw new GitHubError(403, "GET issue");
  };
  await tick(f.deps);
  expect(f.state().batch!.status).toBe("blocked");
  expect(f.state().batch!.networkRetries).toBeUndefined();
});

test("integrated implementation defects reserve bounded repairs without reopening approval", async () => {
  const f = fixture();
  f.setReview({
    ...f.goodReview(),
    approved: false,
    verdict: "request_changes",
    findings: ["Combined journey loses its persisted receipt"],
  });
  for (let n = 1; n <= 3; n++) {
    f.startReview();
    await tick(f.deps);
    if (n <= 2) {
      expect(f.state().batch!.status).toBe("running");
      expect(f.state().batch!.integrationRepair).toEqual({ attempts: n, pending: true });
    }
  }
  expect(f.state().batch!.status).toBe("blocked");
  expect(f.state().batch!.error).toContain("Integrated repair budget exhausted");
  expect(f.prs()).toBe(0);
});

test("automatic deployed defects invalidate old receipts and reserve implementation repair", async () => {
  const f = fixture();
  f.enableDeployment();
  f.startReview();
  const b = f.state().batch!;
  b.startedAt = Date.now();
  b.active!.phase = "deployed-review";
  b.automaticDeployment = {
    id: "factory-approved-request",
    candidate: b.candidate,
    requestedAt: Date.now(),
    posted: true,
    workflowHash: "h",
    scriptHash: "h",
    coverageHash: "h",
  };
  b.integratedReview = { commit: b.candidate, review: f.goodReview() };
  f.setReview({
    ...f.deployedReview(),
    approved: false,
    verdict: "request_changes",
    findings: ["Approved receipt disappears on navigation"],
  });
  await tick(f.deps);
  expect(f.state().batch!.status).toBe("running");
  expect(f.state().batch!.integrationRepair?.pending).toBe(true);
  expect(f.state().batch!.deployment).toBeUndefined();
  expect(f.state().batch!.automaticDeployment).toBeUndefined();
  expect(f.state().batch!.integratedReview).toBeUndefined();
  await tick(f.deps);
  expect(f.state().batch!.active?.phase).toBe("build");
});

test("CI repair is reviewed, updates the existing delivery branch, and repeats integrated acceptance", async () => {
  const f = fixture(),
    candidate = "b".repeat(40),
    fixed = "c".repeat(40);
  const b = f.state().batch!;
  b.coverage!.ci = { app: "github-actions", checks: ["Test"], maxRepairs: 2 };
  b.integratedReview = { commit: candidate, review: f.goodReview() };
  let branchHead = candidate,
    checksPass = false,
    patches = 0;
  const gh = f.deps.github;
  f.deps.github = async <T>(path: string, method?: string): Promise<T> => {
    if (path.includes("/check-runs?"))
      return {
        total_count: 1,
        check_runs: [
          {
            id: checksPass ? 2 : 1,
            name: "Test",
            head_sha: branchHead,
            status: "completed",
            conclusion: checksPass ? "success" : "failure",
            app: { slug: "github-actions" },
          },
        ],
      } as T;
    if (path.startsWith("/compare/"))
      return { status: "ahead", files: [{ filename: "apps/fix.ts" }] } as T;
    if (method === "PATCH" && path === "/git/refs/heads/cursor/loan") {
      patches++;
      branchHead = fixed;
      checksPass = true;
      return {} as T;
    }
    if (path.startsWith("/pulls?") && f.state().batch!.pr)
      return [{ html_url: f.state().batch!.pr }] as T;
    return gh<T>(path, method);
  };
  f.deps.head = async (branch: string) =>
    branch === "staging"
      ? "a".repeat(40)
      : branch === "cursor/fix"
        ? fixed
        : branch.startsWith("factory/input/")
          ? f.state().batch!.active!.base
          : branchHead;
  await tick(f.deps); // Fresh failing CI reserves one repair before dispatch.
  expect(f.state().batch!.ci?.repairs).toBe(1);
  expect(f.state().batch!.integratedReview).toBeUndefined();
  await tick(f.deps);
  expect(f.state().batch!.active?.phase).toBe("build");
  f.deps.advanceRemote = async () => ({
    result: "",
    id: "build-fix",
    agentId: f.state().batch!.active!.agentId,
    status: "FINISHED",
    git: { branches: [{ repoUrl: "https://github.com/acme/product", branch: "cursor/fix" }] },
  });
  await tick(f.deps);
  expect(f.state().batch!.active?.phase).toBe("review");
  const commands = executionCommands(f.state().batch!, repairJob(f.state().batch!));
  f.deps.advanceRemote = async () => ({
    id: "review-fix",
    agentId: f.state().batch!.active!.agentId,
    status: "FINISHED",
    result: JSON.stringify({
      ...f.goodReview(),
      commit: fixed,
      checks: commands.map((command) => ({
        command,
        exitCode: 0,
        evidence: "independent CI repair verification",
      })),
    }),
  });
  await tick(f.deps);
  expect(patches).toBe(1);
  expect(f.state().batch!.resultBranch).toBe("cursor/loan");
  expect(f.state().batch!.candidate).toBe(fixed);
  expect(f.state().batch!.accepted).toEqual(["loan"]);
  expect(f.state().batch!.integratedReview).toBeUndefined();
  await tick(f.deps);
  expect(f.state().batch!.active?.phase).toBe("integrated-review");
  const combined = executionCommands(f.state().batch!, integratedJob(f.state().batch!));
  f.deps.advanceRemote = async () => ({
    id: "integrated-fixed",
    agentId: f.state().batch!.active!.agentId,
    status: "FINISHED",
    result: JSON.stringify({
      ...f.goodReview(),
      commit: fixed,
      checks: combined.map((command) => ({
        command,
        exitCode: 0,
        evidence: "full candidate verified",
      })),
    }),
  });
  await tick(f.deps);
  await tick(f.deps);
  expect(f.state().batch!.status).toBe("review");
  expect(f.state().batch!.ci?.result).toBe("passed");
  expect(f.prs()).toBe(1);
});

test("ambiguous deployment dispatch is checkpointed once and reconciled after restart", async () => {
  const f = fixture(),
    b = f.state().batch!;
  b.integratedReview = { commit: b.candidate, review: f.goodReview() };
  b.coverage!.ci = { app: "github-actions", checks: ["Test"], maxRepairs: 1 };
  b.coverage!.deployed = {
    environment: "staging",
    origin: "https://staging.example.com",
    creator: "github-actions[bot]",
    checks: [["bun", "run", "e2e"]],
    automatic: {
      workflow: ".github/workflows/factory-staging.yml",
      setup: [],
      command: ["bun", "scripts/deploy.ts"],
      sources: ["scripts/deploy.ts"],
    },
  };
  b.manifest.specFiles.push(
    ".github/workflows/factory-staging.yml",
    ".github/scripts/factory-staging.ts",
  );
  let dispatches = 0;
  const gh = f.deps.github;
  const deps = { ...f.deps, file: async () => ({ text: "approved control", sha: "blob" }) };
  deps.head = async (branch) =>
    branch.startsWith("factory/deployment/") || branch === "staging" ? b.commit : b.candidate;
  deps.github = async <T>(path: string, method?: string): Promise<T> => {
    if (path.includes("/check-runs?"))
      return {
        total_count: 1,
        check_runs: [
          {
            id: 1,
            name: "Test",
            head_sha: b.candidate,
            status: "completed",
            conclusion: "success",
            app: { slug: "github-actions" },
          },
        ],
      } as T;
    if (path.endsWith("/dispatches")) {
      dispatches++;
      expect(f.state().batch!.automaticDeployment?.posted).toBe(true);
      expect(f.state().lease).toBeDefined();
      throw new Error("response lost after acceptance");
    }
    if (path.includes("/runs?"))
      return {
        workflow_runs: [
          {
            id: 7,
            display_title: f.state().batch!.automaticDeployment!.id,
            head_sha: b.commit,
            head_branch: `factory/deployment/${f.state().batch!.automaticDeployment!.id}`,
            status: "completed",
            conclusion: "success",
          },
        ],
      } as T;
    if (path.includes("sha="))
      return [
        {
          id: 10,
          sha: b.candidate,
          payload: { request_id: f.state().batch!.automaticDeployment!.id, run_id: 7 },
        },
      ] as T;
    const response = await gh<any>(path, method);
    if (path === "/deployments/10") response.creator.login = "github-actions[bot]";
    if (path.includes("/statuses?")) response[0].creator.login = "github-actions[bot]";
    return response as T;
  };
  await tick(deps); // Reserve immutable request.
  const requestId = f.state().batch!.automaticDeployment!.id;
  await tick(deps); // Persist dispatch intent, ambiguous network response.
  expect(f.state().lease).toBeUndefined();
  await tick(deps); // Fresh transition recovers authenticated deployment records.
  expect(dispatches).toBe(1);
  expect(f.state().batch!.automaticDeployment?.id).toBe(requestId);
  expect(f.state().batch!.deployment?.commit).toBe(b.candidate);
  expect(f.state().batch!.status).toBe("running");
  expect(f.state().batch!.deployedReview).toBeUndefined();
});
