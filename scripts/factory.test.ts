import { afterEach, expect, test } from "bun:test";
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { git, type Ledger, type Manifest, read, save, validate } from "./factory/core";

const cli = resolve(import.meta.dir, "factory.ts");
const dirs: string[] = [];
const children: ChildProcess[] = [];
afterEach(() => {
  for (const c of children)
    try {
      c.kill("SIGKILL");
    } catch {}
  children.length = 0;
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});
const check = (code: string) => [process.execPath, "-e", code];
function fixture(
  options: { bad?: boolean; slow?: boolean; escape?: boolean; retry?: boolean } = {},
) {
  const root = mkdtempSync(join(tmpdir(), "factory-test-"));
  dirs.push(root);
  git(root, "init", "-b", "staging");
  git(root, "config", "user.name", "Test");
  git(root, "config", "user.email", "test@localhost");
  writeFileSync(join(root, ".gitignore"), ".factory/\n");
  writeFileSync(join(root, "spec.md"), "Approved synthetic two-slice tool. J1.S1 and J1.S2.\n");
  writeFileSync(
    join(root, "worker.ts"),
    `import {writeFileSync,existsSync} from 'node:fs';
 const id=process.env.FACTORY_JOB_ID;
 ${options.slow ? "await Bun.sleep(1800);" : ""}
 if(id==='B'&&!existsSync('A.txt'))throw new Error('dependency absent');
 writeFileSync(${options.escape ? "'spec.md'" : "id+'.txt'"},${options.bad ? "'wrong'" : options.retry ? "process.env.FACTORY_ATTEMPT==='1'?'wrong':id" : "id"});
 `,
  );
  git(root, "add", ".");
  git(root, "commit", "-m", "fixture");
  const m: Manifest = {
    version: 1,
    id: "test-run",
    base: "staging",
    approval: "Explicit synthetic fixture approval",
    simulation: true,
    specFiles: ["spec.md"],
    worker: { kind: "command", command: [process.execPath, "worker.ts"] },
    limits: { attempts: options.retry ? 2 : 1, jobSeconds: 10, runSeconds: 40 },
    jobs: ["A", "B"].map((id, i) => ({
      id,
      title: id,
      instructions: `Write ${id}.txt with ${id}`,
      steps: [`J1.S${i + 1}`],
      dependsOn: i ? ["A"] : [],
      paths: [`${id}.txt`],
      checks: [check(`if(await Bun.file('${id}.txt').text()!=='${id}')process.exit(1)`)],
      review: check(`if(!(await Bun.file('${id}.txt').exists()))process.exit(2)`),
    })),
    combinedChecks: [check("if(!(await Bun.file('A.txt').exists()))process.exit(3)")],
  };
  save(join(root, "factory.json"), m);
  execFileSync(process.execPath, [cli, "prepare", "factory.json"], { cwd: root, stdio: "pipe" });
  return {
    root,
    path: join(root, "factory.json"),
    ledger: join(root, ".factory/test-run/ledger.json"),
  };
}
function start(root: string) {
  const p = spawn(process.execPath, [cli, "run", "factory.json"], { cwd: root, stdio: "ignore" });
  children.push(p);
  return p;
}
async function waitFor(predicate: () => boolean, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (predicate()) return;
    await Bun.sleep(30);
  }
  throw new Error("Timed out");
}
async function finish(p: ChildProcess) {
  if (p.exitCode !== null) return;
  await new Promise<void>((r) => p.once("exit", () => r()));
}
test("two dependent jobs integrate serially; source checkout and staging stay unchanged", async () => {
  const f = fixture();
  const original = git(f.root, "rev-parse", "staging");
  await finish(start(f.root));
  const s = read<Ledger>(f.ledger);
  expect(s.status).toBe("completed-local");
  expect(s.jobs.A.status).toBe("accepted");
  expect(s.jobs.B.status).toBe("accepted");
  expect(git(f.root, "show", `${s.integration}:B.txt`)).toBe("B");
  expect(git(f.root, "rev-parse", "staging")).toBe(original);
  expect(existsSync(join(f.root, "A.txt"))).toBe(false);
  expect(git(f.root, "rev-list", "--count", `${original}..${s.branch}`)).toBe("2");
  await finish(start(f.root));
  expect(read<Ledger>(f.ledger).jobs.A.attempts).toHaveLength(1);
}, 20000);
test("required check failure blocks dependent work", async () => {
  const f = fixture({ bad: true });
  await finish(start(f.root));
  const s = read<Ledger>(f.ledger);
  expect(s.status).toBe("failed");
  expect(s.jobs.A.status).toBe("failed");
  expect(s.jobs.B.status).toBe("blocked");
  expect(s.jobs.B.attempts).toHaveLength(0);
}, 20000);
test("bounded retry uses new worktree and concrete feedback", async () => {
  const f = fixture({ retry: true });
  await finish(start(f.root));
  const s = read<Ledger>(f.ledger);
  expect(s.status).toBe("completed-local");
  expect(s.jobs.A.attempts).toHaveLength(2);
  const req = read<{ priorError: string }>(join(s.jobs.A.attempts[1].dir, "request.json"));
  expect(req.priorError).toContain("check-0 failed");
}, 20000);
test("supervisor SIGKILL resumes the existing worker without duplicate attempt", async () => {
  const f = fixture({ slow: true });
  const p = start(f.root);
  await waitFor(() => existsSync(f.ledger) && read<Ledger>(f.ledger).jobs.A.status === "running");
  await waitFor(() =>
    existsSync(join(read<Ledger>(f.ledger).jobs.A.attempts[0].dir, "claim.json")),
  );
  p.kill("SIGKILL");
  await finish(p);
  await finish(start(f.root));
  const s = read<Ledger>(f.ledger);
  expect(s.status).toBe("completed-local");
  expect(s.jobs.A.attempts).toHaveLength(1);
  expect(s.jobs.B.attempts).toHaveLength(1);
}, 20000);
test("out-of-scope edits cannot be accepted", async () => {
  const f = fixture({ escape: true });
  await finish(start(f.root));
  const s = read<Ledger>(f.ledger);
  expect(s.jobs.A.status).toBe("failed");
  expect(s.jobs.A.error).toContain("Out-of-scope edit");
}, 20000);
test("second controller cannot duplicate work", async () => {
  const f = fixture({ slow: true });
  const first = start(f.root);
  await waitFor(() => existsSync(f.ledger));
  const second = start(f.root);
  await finish(second);
  expect(second.exitCode).toBe(1);
  await finish(first);
  expect(read<Ledger>(f.ledger).jobs.A.attempts).toHaveLength(1);
}, 20000);
test("changed specification refuses resume", async () => {
  const f = fixture();
  writeFileSync(join(f.root, "spec.md"), "changed");
  const p = start(f.root);
  await finish(p);
  expect(p.exitCode).toBe(1);
  expect(existsSync(f.ledger)).toBe(false);
});
test("missing required browser and dependency cycles reject before dispatch", () => {
  const f = fixture();
  const m = read<Manifest>(f.path);
  m.jobs[0].requiresBrowser = true;
  expect(() => validate(f.root, m)).toThrow("browser");
  m.jobs[0].requiresBrowser = false;
  m.jobs[0].dependsOn = ["B"];
  expect(() => validate(f.root, m)).toThrow("cycle");
});
test("delivery only succeeds with a receipt for the exact integrated commit", async () => {
  const f = fixture();
  const m = read<Manifest>(f.path);
  m.delivery = {
    command: check("console.log('synthetic deploy')"),
    verify: check(
      "await Bun.write(process.env.FACTORY_RECEIPT,JSON.stringify({commit:process.env.FACTORY_BASE,url:'http://localhost:9999/synthetic',verified:true}))",
    ),
  };
  save(f.path, m);
  await finish(start(f.root));
  expect(read<Ledger>(f.ledger).status).toBe("delivered");
}, 20000);
test("wrong deployed commit never becomes delivered", async () => {
  const f = fixture();
  const m = read<Manifest>(f.path);
  m.delivery = {
    command: check("console.log('synthetic deploy')"),
    verify: check(
      "await Bun.write(process.env.FACTORY_RECEIPT,JSON.stringify({commit:'wrong',url:'http://localhost:9999',verified:true}))",
    ),
  };
  save(f.path, m);
  await finish(start(f.root));
  expect(read<Ledger>(f.ledger).status).toBe("failed");
}, 20000);

test("worker deadline fails and leaves dependent jobs blocked", async () => {
  const f = fixture({ slow: true });
  const m = read<Manifest>(f.path);
  m.limits.jobSeconds = 1;
  save(f.path, m);
  await finish(start(f.root));
  const s = read<Ledger>(f.ledger);
  expect(s.jobs.A.status).toBe("failed");
  expect(s.jobs.B.status).toBe("blocked");
}, 15000);
test("cancel fences active work and cannot accept it", async () => {
  const f = fixture({ slow: true });
  const p = start(f.root);
  await waitFor(() => existsSync(f.ledger) && read<Ledger>(f.ledger).jobs.A.status === "running");
  execFileSync(process.execPath, [cli, "cancel", "factory.json"], { cwd: f.root, stdio: "pipe" });
  await finish(p);
  const s = read<Ledger>(f.ledger);
  expect(s.status).toBe("cancelled");
  expect(s.jobs.A.status).not.toBe("accepted");
}, 15000);
test("an externally moved integration branch rejects stale checks", async () => {
  const f = fixture({ slow: true });
  const p = start(f.root);
  await waitFor(() => existsSync(f.ledger) && read<Ledger>(f.ledger).jobs.A.status === "running");
  const state = read<Ledger>(f.ledger);
  git(f.root, "commit", "--allow-empty", "-m", "outside change");
  git(f.root, "update-ref", state.branch, git(f.root, "rev-parse", "HEAD"));
  await finish(p);
  expect(read<Ledger>(f.ledger).status).toBe("blocked");
  expect(read<Ledger>(f.ledger).jobs.A.status).not.toBe("accepted");
}, 15000);

test("recovery reconciles integration completed just before ledger save", async () => {
  const f = fixture();
  await finish(start(f.root));
  const s = read<Ledger>(f.ledger);
  const accepted = s.integration;
  s.jobs.B.status = "running";
  s.integration = s.jobs.A.commit as string;
  s.status = "running";
  save(f.ledger, s);
  await finish(start(f.root));
  const recovered = read<Ledger>(f.ledger);
  expect(recovered.status).toBe("completed-local");
  expect(recovered.integration).toBe(accepted);
  expect(recovered.jobs.B.attempts).toHaveLength(1);
}, 15000);
test("dead attempt runner fails without silently accepting partial work", async () => {
  const f = fixture({ slow: true });
  const p = start(f.root);
  await waitFor(() => existsSync(f.ledger) && read<Ledger>(f.ledger).jobs.A.status === "running");
  const attempt = read<Ledger>(f.ledger).jobs.A.attempts[0];
  await waitFor(
    () =>
      existsSync(join(attempt.dir, "progress.json")) &&
      !!read<{ childPid?: number }>(join(attempt.dir, "progress.json")).childPid,
  );
  process.kill(read<{ pid: number }>(join(attempt.dir, "claim.json")).pid, "SIGKILL");
  await finish(p);
  const s = read<Ledger>(f.ledger);
  expect(s.jobs.A.status).toBe("failed");
  expect(s.jobs.A.error).toContain("runner exited without a result");
  expect(s.jobs.B.attempts).toHaveLength(0);
}, 15000);

test("browser command exiting zero without evidence cannot accept a slice", async () => {
  const f = fixture();
  const m = read<Manifest>(f.path);
  m.jobs[0].requiresBrowser = true;
  m.jobs[0].browser = check("console.log('no tests ran')");
  save(f.path, m);
  await finish(start(f.root));
  expect(read<Ledger>(f.ledger).jobs.A.status).toBe("failed");
}, 15000);
test("browser receipt must identify the exact tested candidate", async () => {
  const f = fixture();
  const m = read<Manifest>(f.path);
  m.jobs[0].requiresBrowser = true;
  m.jobs[0].browser = check(
    "await Bun.write(process.env.FACTORY_BROWSER_RECEIPT,JSON.stringify({tree:process.env.FACTORY_TREE,passed:true,cases:1}))",
  );
  save(f.path, m);
  await finish(start(f.root));
  expect(read<Ledger>(f.ledger).status).toBe("completed-local");
}, 15000);

test("Playwright adapter rejects a successful CLI with zero executed tests", () => {
  const f = fixture();
  const binary = join(f.root, "node_modules/.bin/playwright");
  mkdirSync(join(f.root, "node_modules/.bin"), { recursive: true });
  const execute = (expected: number) => {
    writeFileSync(
      binary,
      `#!/usr/bin/env bun\nawait Bun.write(process.env.PLAYWRIGHT_JSON_OUTPUT_FILE, JSON.stringify({stats:{expected:${expected},unexpected:0,flaky:0}}));\n`,
    );
    chmodSync(binary, 0o755);
    return () =>
      execFileSync(process.execPath, [resolve(import.meta.dir, "factory/browser.ts")], {
        cwd: f.root,
        env: {
          ...process.env,
          FACTORY_ATTEMPT_DIR: f.root,
          FACTORY_BROWSER_RECEIPT: join(f.root, "browser.json"),
          FACTORY_TREE: "candidate",
        },
        stdio: "pipe",
      });
  };
  expect(execute(0)).toThrow();
  expect(execute(1)).not.toThrow();
  expect(read<{ cases: number }>(join(f.root, "browser.json")).cases).toBe(1);
});
test("review findings fail even when the reviewer process exits zero", () => {
  const f = fixture();
  const executable = join(f.root, "reviewer");
  writeFileSync(
    executable,
    "#!/usr/bin/env bun\nawait Bun.write(process.argv[process.argv.indexOf('--output-last-message')+1],JSON.stringify({approved:false,findings:['Incorrect empty input behavior']}));\n",
  );
  chmodSync(executable, 0o755);
  const m = read<Manifest>(f.path);
  m.worker.executable = executable;
  save(join(f.root, "request.json"), {
    manifest: m,
    job: m.jobs[0],
    worktree: f.root,
    base: m.base,
  });
  expect(() =>
    execFileSync(process.execPath, [resolve(import.meta.dir, "factory/review.ts")], {
      cwd: f.root,
      env: { ...process.env, FACTORY_ATTEMPT_DIR: f.root },
      stdio: "pipe",
    }),
  ).toThrow();
});

test("first cloud slice is a bounded review gate, separate from accepted-product execution", () => {
  const f = fixture();
  const m = read<Manifest>(f.path);
  m.phase = "first-slice";
  expect(() => validate(f.root, m)).toThrow("one reviewable slice");
  m.jobs = m.jobs.slice(0, 1);
  expect(() => validate(f.root, m)).not.toThrow();
  m.delivery = { command: check(""), verify: check("") };
  expect(() => validate(f.root, m)).toThrow("no automatic delivery");
});

test("first-slice success waits for review instead of claiming product completion", async () => {
  const f = fixture();
  const m = read<Manifest>(f.path);
  m.phase = "first-slice";
  m.jobs = m.jobs.slice(0, 1);
  save(f.path, m);
  const process = start(f.root);
  await waitFor(() => process.exitCode !== null);
  expect(read<Ledger>(f.ledger).status).toBe("awaiting-review");
});

test("explicit resume keeps a blocked attempt, its prompt and evidence instead of buying another attempt", async () => {
  const f = fixture();
  const m = read<Manifest>(f.path);
  m.jobs = m.jobs.slice(0, 1);
  m.jobs[0].review = check(
    `if(!require('node:fs').existsSync(${JSON.stringify(join(f.root, "ready"))}))process.exit(1)`,
  );
  save(f.path, m);
  execFileSync(process.execPath, [cli, "prepare", f.path], { cwd: f.root, stdio: "pipe" });
  const first = start(f.root);
  await waitFor(() => first.exitCode !== null);
  const state = read<Ledger>(f.ledger);
  const attempt = state.jobs.A.attempts[0];
  const output = join(attempt.dir, "result.json");
  save(output, { ...read<Record<string, unknown>>(output), blocked: true });
  state.status = "blocked";
  state.jobs.A.status = "running";
  save(f.ledger, state);
  writeFileSync(join(f.root, "ready"), "external blocker resolved");
  const resumed = spawn(process.execPath, [cli, "resume", f.path], {
    cwd: f.root,
    stdio: "ignore",
  });
  children.push(resumed);
  await waitFor(() => resumed.exitCode !== null);
  const done = read<Ledger>(f.ledger);
  expect(done.status).toBe("completed-local");
  expect(done.jobs.A.attempts).toHaveLength(1);
});
