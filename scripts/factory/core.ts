import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type Command = string[];
export type Job = {
  id: string;
  title: string;
  instructions: string;
  steps: string[];
  dependsOn: string[];
  paths: string[];
  checks: Command[];
  review: Command;
  browser?: Command;
  requiresBrowser?: boolean;
};
export type Manifest = {
  version: 1;
  id: string;
  base: string;
  specFiles: string[];
  specHash?: string;
  approval: string;
  simulation?: boolean;
  phase?: "first-slice" | "product";
  worker: {
    kind: "codex" | "command" | "cursor";
    command?: Command;
    executable?: string;
    repository?: string;
  };
  limits: { attempts: number; jobSeconds: number; runSeconds: number };
  jobs: Job[];
  setup?: Command[];
  combinedChecks: Command[];
  delivery?: { command: Command; verify: Command };
};
export function read<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8"));
}
export function save(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temp, path);
}
export function git(root: string, ...args: string[]) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
export function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function alive(pid?: number) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
export function safePath(path: string) {
  return (
    !!path &&
    !path.startsWith("/") &&
    !path.split(/[\\/]/).some((p) => p === ".." || p === ".git" || p === ".factory") &&
    !path.includes("\\")
  );
}
export function specHash(root: string, m: Manifest) {
  return hash(m.specFiles.map((path) => [path, readFileSync(resolve(root, path), "utf8")]));
}
function command(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((v) => typeof v === "string" && v.length > 0)
  );
}
export function validate(root: string, m: Manifest, sealed = true) {
  if (m.version !== 1 || !/^[a-z0-9][a-z0-9-]{0,48}$/.test(m.id))
    throw new Error("Invalid manifest version/id");
  if (!m.approval?.trim() || !m.base || !m.specFiles?.length || !m.specFiles.every(safePath))
    throw new Error("Base, spec files and approval evidence are required");
  if (!m.jobs?.length || !m.combinedChecks?.length || !m.combinedChecks.every(command))
    throw new Error("Jobs and combined checks are required");
  for (const key of ["attempts", "jobSeconds", "runSeconds"] as const)
    if (!Number.isSafeInteger(m.limits?.[key]) || m.limits[key] < 1)
      throw new Error(`Invalid limit ${key}`);
  if (
    !["codex", "command", "cursor"].includes(m.worker?.kind) ||
    (m.worker.kind === "command" && !command(m.worker.command))
  )
    throw new Error("Invalid worker adapter");
  if (
    m.worker.kind === "cursor" &&
    !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(m.worker.repository ?? "")
  )
    throw new Error("Cursor requires an explicit GitHub repository URL");
  if (m.phase && !["first-slice", "product"].includes(m.phase))
    throw new Error("Invalid factory phase");
  if (m.phase === "first-slice" && (m.jobs.length !== 1 || m.delivery))
    throw new Error("First-slice runs contain one reviewable slice and no automatic delivery");
  const ids = new Set(m.jobs.map((j) => j.id));
  if (ids.size !== m.jobs.length) throw new Error("Duplicate jobs");
  for (const job of m.jobs) {
    if (
      !/^[a-zA-Z0-9-]+$/.test(job.id) ||
      !job.title ||
      !job.instructions ||
      !job.steps?.length ||
      !job.paths?.length ||
      !job.paths.every(safePath)
    )
      throw new Error(`Invalid job ${job.id}`);
    if (
      job.review?.[0] === "cursor-cloud" &&
      (job.review.length !== 1 || m.worker.kind !== "cursor")
    )
      throw new Error("Cursor review requires the Cursor worker configuration");
    if (!job.dependsOn || job.dependsOn.some((id) => !ids.has(id) || id === job.id))
      throw new Error(`Invalid dependency ${job.id}`);
    if (job.paths.some((p) => p.startsWith("apps/web")) && !job.requiresBrowser)
      throw new Error(`Web slice ${job.id} must require browser verification`);
    if (
      !job.checks?.length ||
      !job.checks.every(command) ||
      !command(job.review) ||
      (job.requiresBrowser && !command(job.browser))
    )
      throw new Error(`Required checks/review/browser missing for ${job.id}`);
  }
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) throw new Error("Dependency cycle");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const d of m.jobs.find((j) => j.id === id)?.dependsOn ?? []) visit(d);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of ids) visit(id);
  if (m.delivery && (!command(m.delivery.command) || !command(m.delivery.verify)))
    throw new Error("Delivery needs deployment and verification commands");
  if (m.setup && !m.setup.every(command)) throw new Error("Invalid setup commands");
  for (const file of m.specFiles)
    if (git(root, "rev-parse", `${m.base}:${file}`) !== git(root, "hash-object", "--", file))
      throw new Error(`Spec must be committed at the base: ${file}`);
  if (sealed && m.specHash !== specHash(root, m))
    throw new Error("Spec changed: prepare a new run with renewed scope approval");
  if (!m.simulation) {
    const path = resolve(root, "docs/product/state.yaml");
    if (!existsSync(path)) throw new Error("Product state required (or explicit simulation)");
    const state = Bun.YAML.parse(readFileSync(path, "utf8")) as {
      phases?: Record<string, { name: string; status: string; artifact?: string }>;
      engagement?: { site?: string };
      clip?: { acceptance: string; acceptance_decision?: string; evidence?: string };
      decisions?: { id: string; answer: string }[];
    };
    if (
      !Object.values(state.phases ?? {}).some((p) => p.name === "shape" && p.status === "done") ||
      (m.phase !== "first-slice" && state.clip?.acceptance !== "accepted")
    )
      throw new Error("Approved design and accepted first slice required");
    const shape = Object.values(state.phases ?? {}).find((p) => p.name === "shape");
    if (
      !state.engagement?.site?.trim() ||
      !shape?.artifact ||
      !existsSync(resolve(root, shape.artifact)) ||
      (m.phase !== "first-slice" &&
        (!state.clip?.evidence ||
          !existsSync(resolve(root, state.clip.evidence)) ||
          !state.decisions?.some(
            (d) => d.id === state.clip?.acceptance_decision && d.answer?.trim(),
          )))
    )
      throw new Error("Participant and first-slice approval/evidence are required");
    if (!state.decisions?.some((d) => d.id === m.approval && d.answer?.trim()))
      throw new Error("Approval must reference a recorded decision");
  }
}
export function allowed(path: string, paths: string[]) {
  return paths.some((p) => path === p || path.startsWith(`${p.replace(/\/$/, "")}/`));
}
export type Attempt = {
  number: number;
  dir: string;
  worktree: string;
  base: string;
  started: number;
};
export type JobState = {
  status: "pending" | "running" | "accepted" | "failed" | "blocked";
  attempts: Attempt[];
  commit?: string;
  error?: string;
};
export type Ledger = {
  manifestHash: string;
  started: number;
  status: string;
  integration: string;
  branch: string;
  jobs: Record<string, JobState>;
  delivery?: Attempt;
  error?: string;
};
