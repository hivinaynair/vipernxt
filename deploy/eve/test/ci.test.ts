import { expect, test } from "bun:test";
import { inspectCI } from "../agent/lib/ci.js";
import type { github } from "../agent/lib/github.js";
import type { Batch } from "../agent/lib/store.js";

function fixture() {
  const b = {
    candidate: "a".repeat(40),
    coverage: { ci: { app: "github-actions", checks: ["Test", "Build"], maxRepairs: 2 } },
    integratedReview: { commit: "a".repeat(40) },
  } as Batch;
  const checks = ["Test", "Build"].map((name, n) => ({
    id: n + 1,
    name,
    head_sha: b.candidate,
    status: "completed",
    conclusion: "success",
    app: { slug: "github-actions" },
  }));
  const request = (async () => ({
    total_count: checks.length,
    check_runs: checks,
  })) as typeof github;
  return { b, checks, request };
}
test("required CI is verified from fresh records for exact candidate", async () => {
  const f = fixture();
  expect(await inspectCI(f.b, f.request)).toBe("passed");
});
for (const defect of ["stale-sha", "other-app", "missing", "running"])
  test(`CI ${defect} cannot authorize deployment`, async () => {
    const f = fixture();
    if (defect === "stale-sha") f.checks[0].head_sha = "b".repeat(40);
    if (defect === "other-app") f.checks[0].app.slug = "untrusted";
    if (defect === "missing") f.checks.pop();
    if (defect === "running") f.checks[0].status = "in_progress";
    expect(await inspectCI(f.b, f.request)).toBe("pending");
  });
test("duplicate events share a single durable repair reservation", async () => {
  const f = fixture();
  f.checks[0].conclusion = "failure";
  expect(await inspectCI(f.b, f.request)).toBe("repair");
  const restarted = JSON.parse(JSON.stringify(f.b)) as Batch;
  expect(await inspectCI(restarted, f.request)).toBe("repair");
  expect(restarted.ci?.repairs).toBe(1);
  expect(restarted.integratedReview).toBeUndefined();
});
test("second candidate consumes remaining repair; third failure holds", async () => {
  const f = fixture();
  f.checks[0].conclusion = "failure";
  await inspectCI(f.b, f.request);
  for (const char of ["b", "c"]) {
    f.b.candidate = char.repeat(40);
    f.b.ci!.result = "pending";
    f.checks.forEach((c) => {
      c.head_sha = f.b.candidate;
      c.id += 10;
    });
    if (char === "b") expect(await inspectCI(f.b, f.request)).toBe("repair");
    else await expect(inspectCI(f.b, f.request)).rejects.toThrow("budget exhausted");
  }
});
test("ambiguous and oversized check sets fail closed", async () => {
  const f = fixture();
  f.checks.push(f.checks[0]);
  await expect(inspectCI(f.b, f.request)).rejects.toThrow("Ambiguous");
  await expect(
    inspectCI(f.b, (async () => ({ total_count: 101, check_runs: [] })) as typeof github),
  ).rejects.toThrow("bounded");
});
