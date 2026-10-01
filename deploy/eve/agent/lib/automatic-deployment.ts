import { randomUUID } from "node:crypto";
import { verifyDeployment } from "./deployment.js";
import { file, github } from "./github.js";
import { contentHash } from "./requirements-readiness.js";
import type { Batch } from "./store.js";

export type DeploymentRequest = {
  id: string;
  candidate: string;
  requestedAt: number;
  posted?: boolean;
  workflowHash: string;
  scriptHash: string;
  coverageHash: string;
  runId?: number;
};
export async function reserveDeployment(
  b: Batch,
  ref: string,
  read = file,
): Promise<DeploymentRequest> {
  const automatic = b.coverage?.deployed?.automatic;
  if (!automatic) throw new Error("No approved automatic deployment");
  const pinned = [
    automatic.workflow,
    ".github/scripts/factory-staging.ts",
    b.manifest.coverageFile,
  ];
  const hashes: string[] = [];
  for (const path of pinned) {
    if (!b.manifest.specFiles.includes(path))
      throw new Error(`Deployment control must be pinned: ${path}`);
    const approved = await read(path, b.commit);
    if (path !== b.manifest.coverageFile && (await read(path, ref)).text !== approved.text)
      throw new Error("Deployment workflow differs from approved control files");
    hashes.push(contentHash(approved.text));
  }
  return {
    id: `factory-${randomUUID()}`,
    candidate: b.candidate,
    requestedAt: Date.now(),
    workflowHash: hashes[0],
    scriptHash: hashes[1],
    coverageHash: hashes[2],
  };
}
/** Caller checkpoints posted=true BEFORE dispatch. Ambiguous dispatches are reconciled, never blindly repeated. */
export async function dispatchDeployment(b: Batch, ref: string, request = github) {
  const d = b.automaticDeployment!,
    contract = b.coverage!.deployed!;
  await request(
    `/actions/workflows/${encodeURIComponent(contract.automatic!.workflow.split("/").at(-1)!)}/dispatches`,
    "POST",
    {
      ref,
      inputs: {
        candidate: d.candidate,
        request_id: d.id,
        coverage_file: b.manifest.coverageFile,
        coverage_hash: d.coverageHash,
        workflow_hash: d.workflowHash,
        script_hash: d.scriptHash,
        origin: contract.origin,
      },
    },
  );
}
export async function reconcileDeployment(b: Batch, request = github) {
  const d = b.automaticDeployment!,
    contract = b.coverage!.deployed!;
  if (d.candidate !== b.candidate) throw new Error("Deployment request candidate changed");
  const runs = await request<{
    workflow_runs: {
      id: number;
      display_title: string;
      status: string;
      conclusion: string | null;
      head_sha: string;
      head_branch: string;
    }[];
  }>(
    `/actions/workflows/${encodeURIComponent(contract.automatic!.workflow.split("/").at(-1)!)}/runs?event=workflow_dispatch&per_page=100`,
  );
  const matching = runs.workflow_runs.filter((r) => r.display_title === d.id);
  if (matching.length > 1) throw new Error("Duplicate deployment workflow executions");
  const run = matching[0];
  if (!run) return undefined;
  if (run.head_sha !== b.commit || run.head_branch !== `factory/deployment/${d.id}`)
    throw new Error("Deployment workflow ran outside the pinned input ref");
  if (d.runId && d.runId !== run.id) throw new Error("Deployment workflow identity changed");
  d.runId = run.id;
  if (run.status !== "completed") return undefined;
  if (run.conclusion !== "success") throw new Error(`Staging workflow failed: ${run.conclusion}`);
  const deployments = await request<
    { id: number; sha: string; payload: { request_id?: string; run_id?: number } }[]
  >(`/deployments?environment=staging&sha=${b.candidate}&per_page=100`);
  const matches = deployments.filter(
    (dep) =>
      dep.sha === d.candidate && dep.payload?.request_id === d.id && dep.payload?.run_id === run.id,
  );
  if (matches.length !== 1)
    throw new Error("Workflow has no unique deployment receipt for this request");
  const statuses = await request<{ id: number }[]>(
    `/deployments/${matches[0].id}/statuses?per_page=1`,
  );
  if (!statuses[0]) throw new Error("Deployment status missing");
  return verifyDeployment(b, { deploymentId: matches[0].id, statusId: statuses[0].id }, request);
}
