import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const env = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
export function stagingURL(value: unknown, origin: string) {
  if (typeof value !== "string") throw new Error("Deployment command must return a JSON url");
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    u.origin !== origin ||
    u.username ||
    u.password ||
    u.search ||
    u.hash
  )
    throw new Error("Deployment URL differs from approved staging origin");
  return u.href;
}
function argv(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.some((v) => typeof v !== "string" || !v))
    throw new Error("Approved deployment argv required");
  return value;
}
export async function deploy() {
  const candidate = env("FACTORY_CANDIDATE"),
    requestId = env("FACTORY_REQUEST_ID");
  if (!/^[a-f0-9]{40}$/.test(candidate) || !/^factory-[a-f0-9-]{36}$/.test(requestId))
    throw new Error("Invalid deployment identity");
  const repo = env("GITHUB_REPOSITORY");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new Error("Invalid repository");
  const controls = [
    ["control/.github/workflows/factory-staging.yml", "FACTORY_WORKFLOW_HASH"],
    ["control/.github/scripts/factory-staging.ts", "FACTORY_SCRIPT_HASH"],
  ];
  for (const [path, expected] of controls)
    if (hash(readFileSync(path, "utf8")) !== env(expected))
      throw new Error("Deployment control hash mismatch");
  const path = env("FACTORY_COVERAGE_FILE");
  if (
    !/^[A-Za-z0-9_.@/-]+$/.test(path) ||
    path.split("/").some((p) => !p || p === "." || p === "..")
  )
    throw new Error("Invalid coverage path");
  const body = readFileSync(resolve("candidate", path), "utf8");
  if (hash(body) !== env("FACTORY_COVERAGE_HASH")) throw new Error("Deployment contract changed");
  if (
    execFileSync("git", ["rev-parse", "HEAD"], { cwd: "candidate", encoding: "utf8" }).trim() !==
    candidate
  )
    throw new Error("Checkout differs from approved candidate");
  const contract = JSON.parse(body).deployed;
  if (
    contract.environment !== "staging" ||
    contract.origin !== env("FACTORY_ORIGIN") ||
    contract.creator !== "github-actions[bot]"
  )
    throw new Error("Unapproved staging target or creator");
  stagingURL(contract.origin, contract.origin);
  const command = argv(contract.automatic?.command);
  if (!Array.isArray(contract.automatic?.setup)) throw new Error("Approved staging setup required");
  const api = async (path: string, data: unknown) => {
    const r = await fetch(`https://api.github.com/repos/${repo}${path}`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${env("GITHUB_TOKEN")}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`GitHub deployment HTTP ${r.status}`);
    return r.json() as Promise<{ id: number }>;
  };
  const deployment = await api("/deployments", {
    ref: candidate,
    environment: "staging",
    production_environment: false,
    auto_merge: false,
    required_contexts: [],
    payload: { request_id: requestId, run_id: Number(env("GITHUB_RUN_ID")) },
  });
  const childEnv: NodeJS.ProcessEnv = { ...process.env, FACTORY_STAGING_URL: contract.origin };
  delete childEnv.GITHUB_TOKEN;
  const run = (args: string[]) =>
    execFileSync(args[0], args.slice(1), {
      cwd: "candidate",
      env: childEnv,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 20 * 60 * 1000,
    });
  try {
    await api(`/deployments/${deployment.id}/statuses`, {
      state: "in_progress",
      environment: "staging",
    });
    for (const setup of contract.automatic.setup) run(argv(setup));
    const result = JSON.parse(run(command).trim());
    const url = stagingURL(result.url, contract.origin);
    await api(`/deployments/${deployment.id}/statuses`, {
      state: "success",
      environment: "staging",
      environment_url: url,
      auto_inactive: false,
    });
  } catch {
    await api(`/deployments/${deployment.id}/statuses`, {
      state: "failure",
      environment: "staging",
      description: "Staging command failed or returned an unapproved receipt",
    });
    throw new Error(
      "Staging deployment failed; consult the deployment provider using the request identity",
    );
  }
}
if (import.meta.main) await deploy();
