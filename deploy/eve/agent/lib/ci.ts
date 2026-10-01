import { github } from "./github.js";
import type { Batch } from "./store.js";

export type CIState = {
  commit: string;
  result: "pending" | "passed" | "repair";
  repairs: number;
  failed?: string[];
  events: string[];
};
/** Fresh check records, scoped to exact SHA and approved app/names. No webhook prose is execution authority. */
export async function inspectCI(b: Batch, request = github) {
  const policy = b.coverage?.ci;
  if (!policy) return "passed" as const;
  const result = await request<{
    total_count: number;
    check_runs: {
      id: number;
      name: string;
      head_sha: string;
      status: string;
      conclusion: string | null;
      app: { slug: string };
    }[];
  }>(`/commits/${b.candidate}/check-runs?filter=latest&per_page=100`);
  if (result.total_count > 100)
    throw new Error("CI check list exceeds bounded verification window");
  const checks = policy.checks.map((name) => {
    const matches = result.check_runs.filter(
      (c) => c.name === name && c.head_sha === b.candidate && c.app.slug === policy.app,
    );
    if (matches.length > 1) throw new Error(`Ambiguous required CI check: ${name}`);
    return matches[0];
  });
  if (checks.some((c) => !c || c.status !== "completed")) return "pending" as const;
  const failed = checks.filter((c) => c!.conclusion !== "success").map((c) => c!.name);
  const events = checks.map((c) => `${c!.id}:${c!.conclusion}`);
  b.ci ??= { commit: b.candidate, result: "pending", repairs: 0, events: [] };
  if (!failed.length) {
    b.ci = { ...b.ci, commit: b.candidate, result: "passed", events };
    return "passed" as const;
  }
  if (b.ci.commit === b.candidate && b.ci.result === "repair") return "repair" as const;
  if (b.ci.events.some((e) => events.includes(e)) && b.ci.commit === b.candidate)
    throw new Error("CI failure already consumed by a repair");
  if (b.ci.repairs >= policy.maxRepairs)
    throw new Error(`CI repair budget exhausted: ${failed.join(", ")}`);
  b.ci = { commit: b.candidate, result: "repair", repairs: b.ci.repairs + 1, failed, events };
  b.integratedReview = undefined;
  b.deployment = undefined;
  b.deployedReview = undefined;
  b.automaticDeployment = undefined;
  b.feedback = `Repair approved CI checks on exact candidate ${b.candidate}: ${failed.join(", ")}. Do not alter evaluators or broaden requirements.`;
  return "repair" as const;
}
