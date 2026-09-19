import { z } from "zod";
import { github } from "./github.js";
import type { Batch } from "./store.js";

const positive = z.number().int().positive().safe();
export const deploymentReceiptSchema = z
  .object({ deploymentId: positive, statusId: positive })
  .strict();
export const deployedContractSchema = z
  .object({
    environment: z.literal("staging"),
    origin: z
      .string()
      .url()
      .refine((value) => {
        const u = new URL(value);
        return u.protocol === "https:" && u.origin === value && !u.username && !u.password;
      }),
    creator: z.string().min(1),
    checks: z.array(z.array(z.string().min(1)).min(1)).min(1),
    browser: z.array(z.string().min(1)).min(1).optional(),
  })
  .strict();
export type DeploymentReceipt = z.infer<typeof deploymentReceiptSchema>;
export type VerifiedDeployment = DeploymentReceipt & { commit: string; url: string };
export function deploymentReceipt(body: string): DeploymentReceipt {
  const matches = [...body.matchAll(/```factory-deployment\s*\n([\s\S]*?)\n```/g)];
  if (matches.length !== 1) throw new Error("Exactly one factory-deployment receipt is required");
  return deploymentReceiptSchema.parse(JSON.parse(matches[0][1]));
}
export async function verifyDeployment(
  b: Batch,
  receipt: DeploymentReceipt,
  request = github,
): Promise<VerifiedDeployment> {
  const contract = b.coverage?.deployed;
  if (!contract) throw new Error("No approved deployed acceptance contract");
  const deployment = await request<{
    id: number;
    sha: string;
    environment: string;
    production_environment: boolean;
    creator: { login: string };
  }>(`/deployments/${receipt.deploymentId}`);
  const latest = await request<{ id: number }[]>("/deployments?environment=staging&per_page=1");
  if (latest[0]?.id !== receipt.deploymentId)
    throw new Error("A newer staging deployment superseded the approved receipt");
  const statuses = await request<
    {
      id: number;
      state: string;
      environment: string;
      environment_url: string;
      creator: { login: string };
    }[]
  >(`/deployments/${receipt.deploymentId}/statuses?per_page=1`);
  const status = statuses[0];
  if (
    deployment.id !== receipt.deploymentId ||
    deployment.sha !== b.candidate ||
    deployment.environment !== "staging" ||
    deployment.production_environment !== false ||
    deployment.creator.login !== contract.creator
  )
    throw new Error("Deployment is not the approved staging candidate from the trusted creator");
  if (
    !status ||
    status.id !== receipt.statusId ||
    status.state !== "success" ||
    status.environment !== "staging" ||
    status.creator.login !== contract.creator
  )
    throw new Error("Approved deployment status is no longer current, successful and trusted");
  const url = new URL(status.environment_url);
  if (url.origin !== contract.origin || url.username || url.password || url.hash || url.search)
    throw new Error("Deployment URL differs from approved staging origin");
  return { ...receipt, commit: deployment.sha, url: url.href };
}
export function runDeadline(b: Batch) {
  return b.deployment
    ? b.deployment.startedAt + b.manifest.limits.jobSeconds * 1000
    : b.startedAt + b.manifest.limits.runSeconds * 1000;
}
