import { expect, test } from "bun:test";
import { stagingURL } from "../../../.github/scripts/factory-staging.js";
import {
  dispatchDeployment,
  reconcileDeployment,
  reserveDeployment,
} from "../agent/lib/automatic-deployment.js";
import type { file, github } from "../agent/lib/github.js";
import type { Batch } from "../agent/lib/store.js";

function fixture() {
  const b = {
    commit: "a".repeat(40),
    candidate: "b".repeat(40),
    manifest: {
      coverageFile: "docs/coverage.json",
      specFiles: [
        ".github/workflows/factory-staging.yml",
        ".github/scripts/factory-staging.ts",
        "docs/coverage.json",
      ],
    },
    coverage: {
      deployed: {
        environment: "staging",
        origin: "https://staging.example.com",
        creator: "github-actions[bot]",
        automatic: {
          workflow: ".github/workflows/factory-staging.yml",
          setup: [],
          command: ["bun", "scripts/deploy.ts"],
          sources: ["scripts/deploy.ts"],
        },
      },
    },
  } as unknown as Batch;
  const read = (async () => ({ text: "approved control", sha: "file-sha" })) as typeof file;
  const prepare = async () => {
    b.automaticDeployment = await reserveDeployment(b, "staging", read);
  };
  const request = (async (path: string) => {
    const d = b.automaticDeployment!;
    if (path.includes("/runs?"))
      return {
        workflow_runs: [
          {
            id: 7,
            display_title: d.id,
            head_sha: b.commit,
            head_branch: `factory/deployment/${d.id}`,
            status: "completed",
            conclusion: "success",
          },
        ],
      };
    if (path.includes("sha="))
      return [{ id: 10, sha: b.candidate, payload: { request_id: d.id, run_id: 7 } }];
    if (path.includes("/statuses?"))
      return [
        {
          id: 20,
          state: "success",
          environment: "staging",
          environment_url: "https://staging.example.com",
          creator: { login: "github-actions[bot]" },
        },
      ];
    if (path === "/deployments/10")
      return {
        id: 10,
        sha: b.candidate,
        environment: "staging",
        production_environment: false,
        creator: { login: "github-actions[bot]" },
      };
    if (path.startsWith("/deployments?")) return [{ id: 10 }];
    throw new Error(`Unexpected ${path}`);
  }) as typeof github;
  return { b, read, prepare, request };
}
test("deployment identity survives restart and binds workflow plus candidate", async () => {
  const f = fixture();
  await f.prepare();
  const persisted = JSON.parse(JSON.stringify(f.b)) as Batch;
  let calls = 0;
  await dispatchDeployment(persisted, "factory/deployment/pinned", (async (
    _path,
    _method,
    body,
  ) => {
    calls++;
    expect((body as { inputs: { candidate: string; request_id: string } }).inputs).toMatchObject({
      candidate: f.b.candidate,
      request_id: f.b.automaticDeployment!.id,
    });
    throw new Error("response lost");
  }) as typeof github).catch(() => {});
  expect(calls).toBe(1);
  expect((await reconcileDeployment(persisted, f.request))?.commit).toBe(f.b.candidate);
});
test("changed dispatch controls and unpinned scripts block reservation", async () => {
  const f = fixture();
  await expect(
    reserveDeployment(f.b, "staging", (async (_path, ref) => ({
      text: ref === "staging" ? "changed" : "approved",
      sha: "x",
    })) as typeof file),
  ).rejects.toThrow("differs");
  f.b.manifest.specFiles.pop();
  await expect(f.prepare()).rejects.toThrow("must be pinned");
});
for (const defect of [
  "unrelated-run",
  "duplicate-run",
  "wrong-request",
  "wrong-run",
  "wrong-sha",
  "failed-workflow",
  "superseded",
  "wrong-workflow-ref",
])
  test(`cannot accept ${defect}`, async () => {
    const f = fixture();
    await f.prepare();
    const request = (async (path: string) => {
      const result = await f.request<any>(path);
      if (path.includes("/runs?")) {
        if (defect === "unrelated-run") result.workflow_runs[0].display_title = "someone-else";
        if (defect === "duplicate-run") result.workflow_runs.push(result.workflow_runs[0]);
        if (defect === "wrong-workflow-ref") result.workflow_runs[0].head_sha = "c".repeat(40);
        if (defect === "failed-workflow") result.workflow_runs[0].conclusion = "failure";
      }
      if (path.includes("sha=")) {
        if (defect === "wrong-request") result[0].payload.request_id = "someone-else";
        if (defect === "wrong-run") result[0].payload.run_id = 99;
        if (defect === "wrong-sha") result[0].sha = "c".repeat(40);
      }
      if (path === "/deployments?environment=staging&per_page=1" && defect === "superseded")
        result[0].id = 11;
      return result;
    }) as typeof github;
    if (defect === "unrelated-run") expect(await reconcileDeployment(f.b, request)).toBeUndefined();
    else await expect(reconcileDeployment(f.b, request)).rejects.toThrow();
  });
test("deployment command receipts require the approved HTTPS staging origin", () => {
  expect(stagingURL("https://staging.example.com", "https://staging.example.com")).toBe(
    "https://staging.example.com/",
  );
  for (const url of [
    "http://staging.example.com",
    "https://production.example.com",
    "https://user:pass@staging.example.com",
    "https://staging.example.com?token=x",
  ])
    expect(() => stagingURL(url, "https://staging.example.com")).toThrow();
});
