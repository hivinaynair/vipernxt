import { Database } from "bun:sqlite";

import { spawn } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import type { Request, Result } from "./factory/attempt";
import {
  type Attempt,
  alive,
  git,
  hash,
  type Ledger,
  type Manifest,
  read,
  save,
  specHash,
  validate,
} from "./factory/core";

const [action, input] = process.argv.slice(2);
if (!action || action === "--help") {
  console.log(
    "Usage: bun run factory <prepare|start|run|resume|retry|pause|status|cancel> [manifest.json]",
  );
  process.exit(0);
}
const root = git(process.cwd(), "rev-parse", "--show-toplevel");
const manifestPath = resolve(input ?? "docs/product/factory.json");
const m = read<Manifest>(manifestPath);
if (!/^[a-z0-9][a-z0-9-]{0,48}$/.test(m.id)) throw new Error("Invalid run id");
const dir = join(root, ".factory", m.id);
const ledgerPath = join(dir, "ledger.json");
const lockPath = join(dir, "supervisor.json");
const runner = join(import.meta.dir, "factory/attempt.ts");
function lastAttempt(attempts: Attempt[]) {
  const last = attempts.at(-1);
  if (!last) throw new Error("Running job has no attempt");
  return last;
}
function log(message: string) {
  console.log(message);
  writeFileSync(join(dir, "events.jsonl"), `${JSON.stringify({ at: Date.now(), message })}\n`, {
    flag: "a",
    mode: 0o600,
  });
}
function launch(attempt: Attempt, request: Request) {
  if (!existsSync(attempt.worktree)) {
    mkdirSync(join(dir, "worktrees"), { recursive: true });
    git(root, "worktree", "add", "--detach", attempt.worktree, attempt.base);
  }
  mkdirSync(attempt.dir, { recursive: true });
  save(join(attempt.dir, "request.json"), request);
  const fd = openSync(join(attempt.dir, "runner.log"), "a", 0o600);
  const proc = spawn(process.execPath, [runner, attempt.dir], {
    cwd: root,
    detached: true,
    stdio: ["ignore", fd, fd],
  });
  proc.unref();
  closeSync(fd);
}
function result(attempt: Attempt): Result | undefined {
  const path = join(attempt.dir, "result.json");
  if (existsSync(path)) return read<Result>(path);
  const claim = join(attempt.dir, "claim.json");
  if (existsSync(claim)) {
    let pid: number;
    try {
      pid = read<{ pid: number }>(claim).pid;
    } catch {
      if (Date.now() - attempt.started < 5000) return;
      return { ok: false, error: "Interrupted runner claim", finished: Date.now() };
    }
    if (alive(pid)) return;
    // A killed runner can leave an active command process group. Fence it first.
    const progress = join(attempt.dir, "progress.json");
    if (existsSync(progress)) {
      const childPid = read<{ childPid?: number }>(progress).childPid;
      if (childPid)
        try {
          process.kill(-childPid, "SIGKILL");
        } catch {}
    }
    try {
      process.kill(-pid, "SIGKILL");
    } catch {}
    if (m.worker.kind === "cursor" && !read<Request>(join(attempt.dir, "request.json")).delivery) {
      unlinkSync(claim);
      launch(attempt, read<Request>(join(attempt.dir, "request.json")));
      return;
    }
    return {
      ok: false,
      error: "Attempt runner exited without a result; isolated work retained",
      finished: Date.now(),
    };
  }
  return;
}
async function gate(job: string, stage: string) {
  const environment = process.env;
  const url = environment.FACTORY_CONTROL_URL;
  if (!url) return;
  const response = await fetch(`${url}/internal/gate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${environment.FACTORY_CONTROL_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: m.id, job, stage }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Controller gate unavailable or scope changed; execution held");
}
async function run() {
  validate(root, m);
  mkdirSync(dir, { recursive: true });
  const mutex = new Database(join(root, ".factory", "supervisor.sqlite"));
  try {
    mutex.exec("BEGIN IMMEDIATE");
  } catch {
    mutex.close();
    throw new Error("Supervisor already running for this repository");
  }
  save(lockPath, { pid: process.pid });
  let state: Ledger;
  try {
    if (existsSync(ledgerPath)) {
      state = read<Ledger>(ledgerPath);
      if (state.manifestHash !== hash(m)) throw new Error("Manifest changed; use a new run id");
    } else {
      const base = git(root, "rev-parse", `${m.base}^{commit}`);
      const branch = `refs/heads/codex/factory/${m.id}`;
      // Atomic create; never overwrite a pre-existing result branch.
      try {
        git(root, "rev-parse", "--verify", branch);
        throw new Error("Factory branch already exists without a ledger");
      } catch (error) {
        if (String(error).includes("without a ledger")) throw error;
      }
      state = {
        manifestHash: hash(m),
        started: Date.now(),
        status: "running",
        integration: base,
        branch,
        jobs: Object.fromEntries(m.jobs.map((j) => [j.id, { status: "pending", attempts: [] }])),
      };
      save(ledgerPath, state);
    }
    if (action === "resume") {
      if (existsSync(join(dir, "pause"))) unlinkSync(join(dir, "pause"));
      if (state.status === "paused") state.status = "running";
    }
    if (action === "retry") {
      if (!["failed", "blocked"].includes(state.status))
        throw new Error("Retry requires failed or blocked work");
      let retried = false;
      for (const entry of Object.values(state.jobs)) {
        if (entry.status === "failed" && entry.attempts.length < m.limits.attempts) {
          entry.status = "pending";
          retried = true;
        }
        if (entry.status === "blocked") entry.status = "pending";
      }
      if (!retried)
        throw new Error(
          "No safe retry within remaining attempt budget; reconcile blocked work or approve a new batch",
        );
      state.status = "running";
    }
    if (action === "resume" && state.status === "blocked") {
      let recovered = false;
      for (const entry of Object.values(state.jobs)) {
        if (entry.status !== "running") continue;
        const attempt = lastAttempt(entry.attempts);
        const resultPath = join(attempt.dir, "result.json");
        if (!existsSync(resultPath) || !read<Result>(resultPath).blocked) continue;
        const claimPath = join(attempt.dir, "claim.json");
        if (existsSync(claimPath) && alive(read<{ pid: number }>(claimPath).pid))
          throw new Error("Cannot resume a live attempt runner");
        renameSync(resultPath, join(attempt.dir, `blocked-${Date.now()}.json`));
        if (existsSync(claimPath)) unlinkSync(claimPath);
        recovered = true;
      }
      if (recovered) {
        state.status = "running";
        delete state.error;
        save(ledgerPath, state);
        log("Resuming the same blocked attempt and persisted remote identities");
      }
    }
    try {
      git(root, "rev-parse", "--verify", state.branch);
    } catch {
      git(root, "update-ref", state.branch, state.integration, "0".repeat(40));
    }
    if (
      ["completed-local", "awaiting-review", "delivered", "cancelled", "failed"].includes(
        state.status,
      )
    ) {
      console.log(JSON.stringify(state, null, 2));
      return;
    }
    while (true) {
      if (specHash(root, m) !== m.specHash)
        throw new Error("Spec changed during execution; no further jobs will start");
      if (
        existsSync(join(dir, "cancel")) ||
        Date.now() - state.started > m.limits.runSeconds * 1000
      ) {
        for (const job of Object.values(state.jobs))
          if (job.status === "running")
            writeFileSync(join(lastAttempt(job.attempts).dir, "cancel"), "");
        if (state.delivery) writeFileSync(join(state.delivery.dir, "cancel"), "");
        const stillRunning = (a: Attempt) => {
          const receipt = result(a);
          if (receipt?.blocked) throw new Error(receipt.error);
          return existsSync(join(a.dir, "claim.json")) && !receipt;
        };
        const running =
          Object.values(state.jobs).some(
            (j) => j.status === "running" && stillRunning(lastAttempt(j.attempts)),
          ) ||
          (state.delivery && stillRunning(state.delivery));
        if (running) {
          await Bun.sleep(100);
          continue;
        }
        state.status = "cancelled";
        state.error = "Cancelled or run time budget exhausted";
        save(ledgerPath, state);
        return;
      }
      for (const job of m.jobs) {
        const entry = state.jobs[job.id];
        if (entry.status !== "running") continue;
        const attempt = lastAttempt(entry.attempts);
        const done = result(attempt);
        if (!done) {
          if (!existsSync(join(attempt.dir, "claim.json")) && Date.now() - attempt.started > 2000)
            launch(attempt, read<Request>(join(attempt.dir, "request.json")));
          continue;
        }
        if (done.blocked) throw new Error(done.error);
        if (done.ok) {
          await gate(job.id, "integrate");
          if (!done.commit || git(root, "rev-parse", `${done.commit}^`) !== attempt.base)
            throw new Error("Invalid attempt commit parent");
          const head = git(root, "rev-parse", state.branch);
          if (head !== done.commit) {
            if (head !== attempt.base)
              throw new Error("Integration branch moved externally; refusing stale acceptance");
            git(root, "update-ref", state.branch, done.commit, attempt.base);
          }
          state.integration = done.commit;
          entry.commit = done.commit;
          entry.status = "accepted";
          log(`${job.id} accepted at ${done.commit}`);
        } else {
          entry.error = done.error;
          entry.status = entry.attempts.length < m.limits.attempts ? "pending" : "failed";
          log(`${job.id} ${entry.status}: ${done.error}`);
        }
        save(ledgerPath, state);
      }
      if (existsSync(join(dir, "pause"))) {
        state.status = Object.values(state.jobs).some((j) => j.status === "running")
          ? "pausing"
          : "paused";
        save(ledgerPath, state);
        if (state.status === "paused") return;
        await Bun.sleep(100);
        continue;
      }
      if (!Object.values(state.jobs).some((j) => j.status === "running")) {
        for (const job of m.jobs)
          if (
            state.jobs[job.id].status === "pending" &&
            job.dependsOn.some((id) => ["failed", "blocked"].includes(state.jobs[id].status))
          )
            state.jobs[job.id].status = "blocked";
        const job = m.jobs.find(
          (j) =>
            state.jobs[j.id].status === "pending" &&
            j.dependsOn.every((id) => state.jobs[id].status === "accepted"),
        );
        if (job) {
          await gate(job.id, "dispatch");
          const entry = state.jobs[job.id];
          const number = entry.attempts.length + 1;
          const attemptDir = join(dir, "attempts", `${job.id}-${number}`);
          const attempt = {
            number,
            dir: attemptDir,
            worktree: join(dir, "worktrees", `${job.id}-${number}`),
            base: state.integration,
            started: Date.now(),
          };
          entry.attempts.push(attempt);
          entry.status = "running";
          const request = {
            manifest: m,
            job,
            worktree: attempt.worktree,
            base: attempt.base,
            attempt: number,
            deadline: Math.min(
              state.started + m.limits.runSeconds * 1000,
              Date.now() + m.limits.jobSeconds * 1000,
            ),
            priorError: entry.error,
          };
          save(join(attempt.dir, "request.json"), request);
          save(ledgerPath, state);
          launch(attempt, request);
          log(`${job.id} started attempt ${number}`);
        } else if (Object.values(state.jobs).every((j) => j.status === "accepted")) {
          if (!m.delivery) {
            state.status = m.phase === "first-slice" ? "awaiting-review" : "completed-local";
            save(ledgerPath, state);
            log("Local product complete; no deployed verification configured");
            return;
          }
          if (!state.delivery) {
            const attempt = {
              number: 1,
              dir: join(dir, "delivery"),
              worktree: join(dir, "worktrees", "delivery"),
              base: state.integration,
              started: Date.now(),
            };
            state.delivery = attempt;
            const request = {
              manifest: m,
              worktree: attempt.worktree,
              base: attempt.base,
              attempt: 1,
              deadline: state.started + m.limits.runSeconds * 1000,
              delivery: true,
            };
            save(join(attempt.dir, "request.json"), request);
            save(ledgerPath, state);
            launch(attempt, request);
          }
          if (
            !existsSync(join(state.delivery.dir, "claim.json")) &&
            Date.now() - state.delivery.started > 2000
          )
            launch(state.delivery, read<Request>(join(state.delivery.dir, "request.json")));
          const receipt = result(state.delivery);
          if (receipt) {
            state.status = receipt.ok ? "delivered" : "failed";
            state.error = receipt.error;
            save(ledgerPath, state);
            log(`Delivery ${state.status}`);
            return;
          }
        } else {
          state.status = "failed";
          save(ledgerPath, state);
          log("Required jobs failed or blocked");
          return;
        }
      }
      await Bun.sleep(100);
    }
  } catch (error) {
    if (existsSync(ledgerPath)) {
      const s = read<Ledger>(ledgerPath);
      s.error = String(error);
      s.status = "blocked";
      save(ledgerPath, s);
    }
    throw error;
  } finally {
    if (existsSync(lockPath)) unlinkSync(lockPath);
    mutex.exec("ROLLBACK");
    mutex.close();
  }
}
try {
  if (action === "prepare") {
    validate(root, m, false);
    m.base = git(root, "rev-parse", `${m.base}^{commit}`);
    m.specHash = specHash(root, m);
    save(manifestPath, m);
    console.log(`Prepared ${m.id}; commit this manifest before starting`);
  } else if (action === "status") console.log(JSON.stringify(read(ledgerPath), null, 2));
  else if (action === "cancel" || action === "pause") {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, action), "");
    console.log(`${action} requested`);
  } else if (action === "run" || action === "resume" || action === "retry") {
    await run();
    if (
      !["completed-local", "awaiting-review", "delivered"].includes(read<Ledger>(ledgerPath).status)
    )
      process.exitCode = 1;
  } else if (action === "start") {
    validate(root, m);
    mkdirSync(dir, { recursive: true });
    const fd = openSync(join(dir, "supervisor.log"), "a", 0o600);
    const proc = spawn(process.execPath, [import.meta.path, "run", manifestPath], {
      cwd: root,
      detached: true,
      stdio: ["ignore", fd, fd],
    });
    proc.unref();
    closeSync(fd);
    console.log(
      `Supervisor dispatched (${proc.pid}); inspect factory status and ${dir}/supervisor.log`,
    );
  } else
    throw new Error(
      "Usage: bun run factory <prepare|run|resume|start|status|cancel> [manifest.json]",
    );
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
