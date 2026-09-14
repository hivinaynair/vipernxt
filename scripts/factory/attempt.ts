import { spawn } from "node:child_process";
import { closeSync, existsSync, openSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { allowed, type Command, git, type Job, type Manifest, read, save } from "./core";
import {
  cancelCursorAttempts,
  implementWithCursor,
  RemoteUncertain,
  reviewWithCursor,
} from "./cursor";

export type Request = {
  manifest: Manifest;
  job?: Job;
  worktree: string;
  base: string;
  attempt: number;
  deadline: number;
  priorError?: string;
  delivery?: boolean;
};
export type Result = {
  ok: boolean;
  blocked?: boolean;
  commit?: string;
  error?: string;
  usage?: unknown;
  url?: string;
  finished: number;
};
const dir = process.argv[2];
const req = read<Request>(join(dir, "request.json"));
// Each attempt is immutable. Duplicate launchers cannot both execute it.
try {
  const fd = openSync(join(dir, "claim.json"), "wx", 0o600);
  writeFileSync(fd, JSON.stringify({ pid: process.pid }));
  closeSync(fd);
} catch {
  process.exit(0);
}
let child: ReturnType<typeof spawn> | undefined;
let stopping = false;
let stoppedAt = 0;
const stop = () => {
  stopping = true;
  stoppedAt ||= Date.now();
  if (child?.pid) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
  }
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
const guard = setInterval(() => {
  if (Date.now() > req.deadline || existsSync(join(dir, "cancel"))) stop();
}, 100);
const hardGuard = setInterval(() => {
  if (stopping && Date.now() - stoppedAt > (req.manifest.worker.kind === "cursor" ? 45000 : 0)) {
    try {
      process.kill(-process.pid, "SIGKILL");
    } catch {
      process.exit(1);
    }
  }
}, 2000);
let stage = 0;
let candidateTree: string | undefined;
async function command(argv: Command, label: string, input?: string) {
  if (stopping) throw new Error("Cancelled or time budget exhausted");
  const log = join(dir, `${++stage}-${label}.log`);
  const fd = openSync(log, "a", 0o600);
  save(join(dir, "progress.json"), { stage: label, pid: process.pid, at: Date.now() });
  let group: number | undefined;
  try {
    const env = {
      ...process.env,
      FACTORY_ATTEMPT_DIR: dir,
      FACTORY_WORKTREE: req.worktree,
      FACTORY_BASE: req.base,
      FACTORY_TREE: candidateTree,
      FACTORY_BROWSER_RECEIPT: join(dir, "browser.json"),
      FACTORY_JOB_ID: req.job?.id ?? "delivery",
      FACTORY_ATTEMPT: String(req.attempt),
      FACTORY_IDEMPOTENCY_KEY: `${req.manifest.id}/${req.job?.id ?? "delivery"}`,
      FACTORY_RECEIPT: join(dir, "receipt.json"),
    };
    const current = spawn(argv[0], argv.slice(1), {
      cwd: req.worktree,
      detached: true,
      env,
      stdio: ["pipe", fd, fd],
    });
    child = current;
    group = current.pid;
    save(join(dir, "progress.json"), {
      stage: label,
      pid: process.pid,
      childPid: group,
      at: Date.now(),
    });
    current.stdin?.on("error", () => {});
    current.stdin?.end(input);
    const code = await new Promise<number | null>((resolve, reject) => {
      current.once("error", reject);
      current.once("exit", resolve);
    });
    if (stopping || code !== 0) {
      let detail = readFileSync(log, "utf8").slice(-3000);
      for (const [name, value] of Object.entries(process.env))
        if (/TOKEN|KEY|SECRET|PASSWORD|DATABASE_URL/i.test(name) && value && value.length >= 6)
          detail = detail.replaceAll(value, "[REDACTED]");
      throw new Error(`${label} failed (exit ${code}); ${detail}`);
    }
  } finally {
    if (group) {
      try {
        process.kill(-group, "SIGKILL");
      } catch {}
    }
    closeSync(fd);
    child = undefined;
  }
}
function collectUsage() {
  const usage: { stage: string; usage: unknown }[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".log"))) {
    for (const line of readFileSync(join(dir, file), "utf8").split("\n")) {
      try {
        const event = JSON.parse(line);
        if (event.type === "turn.completed")
          usage.push({ stage: file, usage: event.usage ?? null });
      } catch {}
    }
  }
  return usage.length ? usage : null;
}

try {
  let commit = req.base;
  let url: string | undefined;
  for (const [i, cmd] of (req.manifest.setup ?? []).entries()) await command(cmd, `setup-${i}`);
  if (req.delivery) {
    const delivery = req.manifest.delivery;
    if (!delivery) throw new Error("Missing delivery contract");
    await command(delivery.command, "deploy");
    await command(delivery.verify, "deployed-browser");
    const receipt = read<{ commit: string; url: string; verified: boolean }>(
      join(dir, "receipt.json"),
    );
    if (
      receipt.commit !== req.base ||
      receipt.verified !== true ||
      !/^https?:\/\//.test(receipt.url)
    )
      throw new Error("Delivery receipt must verify this exact commit at a real URL");
    url = receipt.url;
  } else {
    const job = req.job;
    if (!job) throw new Error("Missing job contract");
    const prompt = `Implement this approved slice only. Do not deploy, merge, provision, or open pull requests. Do not change acceptance/spec files or edit outside allowed paths. If requirements are missing, report the blocker. The supervisor owns independent checks, acceptance and integration.\n${JSON.stringify({ job, specFiles: req.manifest.specFiles, priorFailure: req.priorError }, null, 2)}`;
    writeFileSync(join(dir, "prompt.txt"), prompt, { mode: 0o600 });
    const argv =
      req.manifest.worker.kind === "codex"
        ? [
            req.manifest.worker.executable ?? "codex",
            "exec",
            "--json",
            "--ephemeral",
            "--sandbox",
            "workspace-write",
            "-c",
            'approval_policy="never"',
            "-C",
            req.worktree,
            "-",
          ]
        : (req.manifest.worker.command ?? []);
    if (req.manifest.worker.kind === "cursor") {
      await implementWithCursor({
        config: {
          repository: req.manifest.worker.repository ?? "",
          gitTransport: req.manifest.worker.gitTransport,
        },
        dir,
        worktree: req.worktree,
        base: req.base,
        prompt: `${prompt}\nCommit your result to the Cursor-created branch. Do not open a PR or merge.`,
        stopped: () => stopping,
        command,
      });
    } else await command(argv, "worker", prompt);
    // Include worker-created commits, staged edits and untracked files; never just HEAD diff.
    git(req.worktree, "add", "-A");
    const changes = git(
      req.worktree,
      "diff",
      "--cached",
      "--no-renames",
      "--name-only",
      "-z",
      req.base,
    )
      .split("\0")
      .filter(Boolean);
    for (const file of changes)
      if (!allowed(file, job.paths) || req.manifest.specFiles.includes(file))
        throw new Error(`Out-of-scope edit: ${file}`);
    if (!changes.length) throw new Error("Worker produced no changes");
    const tree = git(req.worktree, "write-tree");
    candidateTree = tree;
    for (const [i, check] of job.checks.entries()) await command(check, `check-${i}`);
    if (job.browser) {
      await command(job.browser, "browser");
      const browser = read<{ tree: string; passed: boolean; cases: number }>(
        join(dir, "browser.json"),
      );
      if (
        browser.tree !== tree ||
        browser.passed !== true ||
        !Number.isSafeInteger(browser.cases) ||
        browser.cases < 1
      )
        throw new Error(
          "Browser receipt must identify this candidate with at least one passed scenario",
        );
    }
    if (job.review.length === 1 && job.review[0] === "cursor-cloud") {
      await reviewWithCursor({
        config: {
          repository: req.manifest.worker.repository ?? "",
          gitTransport: req.manifest.worker.gitTransport,
        },
        dir,
        worktree: req.worktree,
        base: req.base,
        tree,
        instructions: JSON.stringify({ job, specFiles: req.manifest.specFiles }),
        stopped: () => stopping,
        command,
      });
    } else await command(job.review, "review");
    for (const [i, check] of req.manifest.combinedChecks.entries())
      await command(check, `combined-${i}`);
    git(req.worktree, "add", "-A");
    if (git(req.worktree, "write-tree") !== tree)
      throw new Error("Verification/review modified the candidate; evidence is invalid");
    // commit-tree ignores worker history and creates one known parent. No merge hooks or publication.
    commit = git(
      req.worktree,
      "-c",
      "user.name=ViperNxt Factory",
      "-c",
      "user.email=factory@localhost",
      "commit-tree",
      tree,
      "-p",
      req.base,
      "-m",
      `${job.id}: ${job.title}`,
    );
  }
  save(join(dir, "result.json"), {
    ok: true,
    commit,
    url,
    usage: collectUsage(),
    finished: Date.now(),
  } satisfies Result);
} catch (error) {
  let failure = error;
  if (req.manifest.worker.kind === "cursor" && !(error instanceof RemoteUncertain)) {
    try {
      await cancelCursorAttempts(dir);
    } catch (cleanupError) {
      failure = cleanupError;
    }
  }
  save(join(dir, "result.json"), {
    ok: false,
    error: String(failure),
    blocked: failure instanceof RemoteUncertain,
    usage: collectUsage(),
    finished: Date.now(),
  } satisfies Result);
} finally {
  clearInterval(guard);
  clearInterval(hardGuard);
}
