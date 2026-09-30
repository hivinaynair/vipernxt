/**
 * Free, opt-in simulation of the production engine with real Git, subprocesses,
 * PGlite and Chromium. Provider APIs and customer decisions are synthetic.
 * No network adapter is used. Each transition runs in a fresh coordinator process.
 */
import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { approvedContract } from "../agent/lib/approved-contract.js";
import { digest, type Manifest, validateManifest } from "../agent/lib/contract.js";
import {
  deployedJob,
  executionCommands,
  integratedJob,
  repairJob,
  reviewCriteria,
  tick,
} from "../agent/lib/engine.js";
import { GitHubError } from "../agent/lib/github.js";
import { contentHash, readinessAreas } from "../agent/lib/requirements-readiness.js";
import type { State } from "../agent/lib/store.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const arg = (key: string) => process.argv[process.argv.indexOf(key) + 1];
const output = resolve(arg("--output") ?? "");
if (!process.argv.includes("--output")) throw new Error("Use --output with a NEW empty directory");
const repo = join(output, "product");
const scenario = process.argv.includes("--tick")
  ? JSON.parse(readFileSync(join(output, "config.json"), "utf8")).scenario
  : arg("--scenario");
if (!["happy", "recovery"].includes(scenario)) throw new Error("Use --scenario happy or recovery");
const queuePath = "apps/web/src/features/pod-triage/queue.tsx";
const detailPath = "apps/web/src/app/shipments/[caseId]/page.tsx";
const check = ["bun", "test", "apps/web/src/features/pod-triage/model.test.ts"];
const browser = (kind = "combined", deployed = false) => [
  "bun",
  "docs/evaluation/product-check.ts",
  kind,
  ...(deployed ? ["--deployed"] : []),
];
const readJson = (name: string) => JSON.parse(readFileSync(join(output, name), "utf8"));
function runtimeHashes() {
  const paths = [
    ...readdirSync(join(here, "../agent/lib"))
      .filter((p) => p.endsWith(".ts"))
      .map((p) => join("deploy/eve/agent/lib", p)),
    ...["offline.ts", "product-check.ts", "site.ts"].map((p) => join("deploy/eve/evals", p)),
  ];
  return Object.fromEntries(
    paths.map((path) => [path, contentHash(readFileSync(join(root, path), "utf8"))]),
  );
}
const writeJson = (name: string, value: unknown) => {
  const path = join(output, name),
    temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, null, 2));
  renameSync(temporary, path);
};
function sync(argv: string[], cwd = repo) {
  const result = Bun.spawnSync(argv, { cwd, env: process.env, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode) throw new Error(`${argv.join(" ")}: ${result.stderr.toString()}`);
  return result.stdout.toString().trim();
}
const git = (...args: string[]) => sync(["git", ...args]);
function gitFile(path: string, ref: string) {
  const result = Bun.spawnSync(["git", "show", `${ref}:${path}`], { cwd: repo });
  if (result.exitCode) throw new Error(`Missing pinned file ${path}`);
  return result.stdout.toString();
}
function put(path: string, text: string) {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), text);
}
async function command(
  argv: string[],
  label: string,
  env: Record<string, string | undefined> = {},
) {
  const p = Bun.spawn(argv, {
    cwd: repo,
    env: {
      ...process.env,
      DATABASE_URL: undefined,
      DATABASE_URL_UNPOOLED: undefined,
      NODE_ENV: undefined,
      CI: undefined,
      NEXT_TELEMETRY_DISABLED: "1",
      ...env,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(p.stdout).text(),
    new Response(p.stderr).text(),
    p.exited,
  ]);
  const evidence = JSON.stringify({ argv, exitCode, stdout, stderr }, null, 2);
  writeFileSync(join(output, `${label}.json`), evidence);
  return {
    command: argv,
    exitCode,
    evidence: `${label}.json sha256=${contentHash(evidence)}\n${stdout.slice(-1200)}${stderr.slice(-700)}`,
  };
}
async function initialize() {
  assert(!existsSync(output), "Output directory must be new; previous runs are preserved");
  const product = resolve(arg("--product") ?? "");
  assert(
    process.argv.includes("--product") && existsSync(join(product, "apps/web")),
    "Supply the approved synthetic Claimline checkout with installed dependencies",
  );
  assert.equal(sync(["git", "status", "--porcelain"], product), "", "Product source must be clean");
  mkdirSync(output, { recursive: true });
  sync(["git", "clone", "--no-hardlinks", product, repo], output);
  git("config", "user.name", "Offline factory simulation");
  git("config", "user.email", "simulation@example.invalid");
  git("config", "core.hooksPath", "/dev/null");
  git("remote", "remove", "origin"); // Prevent publication from the simulator.
  assert.equal(
    (
      await command(
        ["bun", "install", "--frozen-lockfile", "--ignore-scripts"],
        "bootstrap-install",
      )
    ).exitCode,
    0,
  );
  writeJson("sources.json", {
    queue: readFileSync(join(repo, queuePath), "utf8"),
    detail: readFileSync(join(repo, detailPath), "utf8"),
  });
  // Wave-0 route/schema/seed shells already exist; rebuild the two approved behaviors.
  put(
    queuePath,
    "export function Queue(_: { shipments: unknown[] }) { return <p>Approved queue pending implementation</p>; }\n",
  );
  put(
    detailPath,
    "export default function ShipmentPage() { return <p>Approved detail pending implementation</p>; }\n",
  );
  for (const file of ["product-check.ts", "site.ts"])
    put(`docs/evaluation/${file}`, readFileSync(join(here, file), "utf8"));
  for (const file of [
    ".github/workflows/factory-staging.yml",
    ".github/scripts/factory-staging.ts",
  ])
    put(file, readFileSync(join(root, file), "utf8"));
  const spine = JSON.parse(
    JSON.stringify({
      journeys: [
        {
          steps: [
            {
              id: "J1.S1",
              screen: "queue",
              criteria: ["Ten cases, six missing first, persisted reload"],
            },
            {
              id: "J1.S2",
              screen: "detail",
              criteria: [
                "Queue link opens INV-003, read-only exception and genuine missing-case 404",
              ],
            },
          ],
        },
      ],
    }),
  );
  put("docs/evaluation/spine.json", JSON.stringify(spine));
  put(
    "docs/evaluation/contract.md",
    "# SIMULATED bounded Claimline contract\nRead-only Shipment, Invoice and POD. Ten seeded cases; six needs-pod first, four ready. Open CF-003 from the queue: INV-003, split-delivery, missing POD. Missing CF-999 returns genuine HTTP 404. No forms, writes, auth, tenancy, integration, upload, model judgment or production rollout. Trusted loopback demonstration only; incumbent billing is fallback.\nAll customer approvals and walkthroughs are synthetic; no real policy or customer acceptance is claimed.\n",
  );
  const coverage = {
    version: 1,
    approval: "SIM-H14",
    scope: "mvp",
    spineFile: "docs/evaluation/spine.json",
    exclusions: [],
    foundations: Object.fromEntries(
      ["authentication", "authorization", "tenancy", "persistence", "navigation"].map((name) => [
        name,
        ["persistence", "navigation"].includes(name)
          ? { applies: true, requirements: ["queue"], consumers: ["detail"] }
          : {
              applies: false,
              reason: "Approved synthetic loopback-only read-only scope; no live rollout",
            },
      ]),
    ),
    integrated: { checks: [check], browser: browser() },
    ci: { app: "github-actions", checks: ["product-types"], maxRepairs: 2 },
    deployed: {
      environment: "staging",
      origin: "https://127.0.0.1:3443",
      creator: "github-actions[bot]",
      checks: [check],
      browser: browser("combined", true),
      automatic: {
        workflow: ".github/workflows/factory-staging.yml",
        setup: [],
        command: ["bun", "docs/evaluation/site.ts"],
        sources: ["docs/evaluation/site.ts"],
      },
    },
    requirements: [
      {
        id: "queue",
        step: "J1.S1",
        criterion: spine.journeys[0].steps[0].criteria[0],
        dependsOn: [],
        delivery: { kind: "job", job: "queue" },
      },
      {
        id: "detail",
        step: "J1.S2",
        criterion: spine.journeys[0].steps[1].criteria[0],
        dependsOn: ["queue"],
        delivery: { kind: "job", job: "detail" },
      },
    ],
  };
  put("docs/evaluation/coverage.json", JSON.stringify(coverage));
  const artifacts = [
    "docs/evaluation/contract.md",
    "docs/evaluation/spine.json",
    "docs/evaluation/coverage.json",
    "docs/evaluation/product-check.ts",
    "docs/evaluation/site.ts",
    ".github/workflows/factory-staging.yml",
    ".github/scripts/factory-staging.ts",
  ];
  const cases = [
    {
      id: "ordinary",
      kind: "ordinary",
      input: "Seeded CF-003 with POD false",
      expected: [
        "Six missing first; queue navigation shows INV-003, split-delivery and no write controls",
      ],
    },
    {
      id: "incomplete",
      kind: "incomplete",
      input: "POD not received on six cases",
      expected: ["needs-pod, never automatic posting or approval"],
    },
    {
      id: "exception",
      kind: "exception",
      input: "CF-999 absent from database",
      expected: ["HTTP 404, no invented record or writes"],
    },
  ].map((c) => ({
    ...c,
    actor: "SIMULATED Maya",
    preconditions: "Seeded isolated read-only local dataset",
    trigger: "Open queue and Shipment",
    requirements: ["queue", "detail"],
  }));
  const packet = {
    version: 1,
    scope: "mvp",
    approval: "SIM-H14",
    coverageFile: "docs/evaluation/coverage.json",
    stateFile: "docs/evaluation/state.json",
    artifacts: artifacts.map((path) => ({
      path,
      sha256: contentHash(readFileSync(join(repo, path), "utf8")),
    })),
    areas: readinessAreas.map((id) => ({
      id,
      applies: true,
      refs: [{ path: "docs/evaluation/contract.md", locator: "bounded Claimline contract" }],
    })),
    requirements: ["queue", "detail"].map((id) => ({
      id,
      refs: [{ path: "docs/evaluation/contract.md", locator: "bounded Claimline contract" }],
      cases: cases.map((c) => c.id),
    })),
    cases,
    assumptions: [],
    findings: [],
    walkthrough: {
      person: "SIMULATED Maya",
      date: "2026-09-30",
      evidence: "Synthetic regression scenario; not a real walkthrough",
      provenance: "simulation",
      cases: cases.map((c) => c.id),
    },
  };
  const packetText = JSON.stringify(packet);
  put("docs/evaluation/readiness.json", packetText);
  put(
    "docs/evaluation/state.json",
    JSON.stringify({
      decisions: [
        {
          id: "SIM-H14",
          answer:
            "SIMULATED: build this bounded scope and local HTTPS staging simulator, zero external spend",
          requirements: {
            file: "docs/evaluation/readiness.json",
            scope: "mvp",
            sha256: contentHash(packetText),
            actions: ["build", "staging"],
          },
        },
      ],
      held: [],
    }),
  );
  const base = git("rev-parse", "HEAD");
  const manifest: Manifest = validateManifest(
    {
      version: 1,
      id: `offline-${scenario}`,
      base,
      approval: "SIM-H14",
      verification: "cursor-cloud",
      requirementsFile: "docs/evaluation/readiness.json",
      coverageFile: "docs/evaluation/coverage.json",
      specFiles: [...artifacts, "docs/evaluation/readiness.json", "docs/evaluation/state.json"],
      setup: [],
      worker: { kind: "cursor", repository: "https://github.com/simulation/claimline" },
      limits: { attempts: 3, jobSeconds: 600, runSeconds: 3600 },
      combinedChecks: [check],
      jobs: [
        {
          id: "queue",
          title: "Approved queue",
          instructions: "Implement read-only seeded queue",
          steps: ["J1.S1"],
          dependsOn: [],
          paths: [queuePath],
          checks: [check],
          browser: browser("queue"),
          requiresBrowser: true,
        },
        {
          id: "detail",
          title: "Approved detail",
          instructions: "Implement approved invoice detail",
          steps: ["J1.S2"],
          dependsOn: ["queue"],
          paths: ["apps/web/src/app/shipments"],
          checks: [check],
          browser: browser("detail"),
          requiresBrowser: true,
        },
      ],
    },
    "simulation/claimline",
  );
  put("docs/evaluation/batch.json", JSON.stringify(manifest));
  git("add", ".");
  git("commit", "-qm", "SIMULATED approved intake and wave-0 shells");
  const commit = git("rev-parse", "HEAD");
  git("branch", "-f", "staging", commit);
  const read = async (path: string, ref: string) => ({ text: gitFile(path, ref) });
  // The real shared intake gate must refuse these synthetic approvals in live mode.
  await assert.rejects(() => approvedContract(manifest, commit, read), /synthetic/);
  const contract = await approvedContract(manifest, commit, read, { allowSimulation: true });
  const source = { commit, manifest: "docs/evaluation/batch.json" };
  writeJson("config.json", {
    scenario,
    source,
    productSource: product,
    productCommit: sync(["git", "rev-parse", "HEAD"], product),
    runtimeSourceHashes: runtimeHashes(),
    clockOffset: 0,
    crashes: [],
  });
  writeJson("state.json", {
    revision: 0,
    state: {
      version: 1,
      batch: {
        issue: 1,
        intakeHash: digest(source),
        commit,
        manifestPath: source.manifest,
        manifest,
        ...contract,
        startedAt: Date.now(),
        status: "running",
        candidate: commit,
        accepted: [],
        attempts: {},
        evidence: [],
      },
    },
  });
  writeJson("provider.json", {
    runs: {},
    prs: [],
    ci: {},
    deployments: [],
    events: [],
    malformed: {},
    dispatches: 0,
  });
  assert.equal((await command(["bun", "run", "db:migrate"], "bootstrap-migrate")).exitCode, 0);
  assert.equal((await command(["bun", "run", "db:seed"], "bootstrap-seed")).exitCode, 0);
  sync(
    [
      "openssl",
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      join(output, "key.pem"),
      "-out",
      join(output, "cert.pem"),
      "-days",
      "1",
      "-subj",
      "/CN=127.0.0.1",
      "-addext",
      "subjectAltName=IP:127.0.0.1",
    ],
    output,
  );
  const pubkey = sync(
    ["openssl", "x509", "-in", join(output, "cert.pem"), "-pubkey", "-noout"],
    output,
  );
  writeFileSync(join(output, "pub.pem"), pubkey);
  const der = Bun.spawnSync([
    "openssl",
    "pkey",
    "-pubin",
    "-in",
    join(output, "pub.pem"),
    "-outform",
    "DER",
  ]);
  writeFileSync(join(output, "spki.txt"), createHash("sha256").update(der.stdout).digest("base64"));
}

async function transition() {
  const config = readJson("config.json");
  assert.deepEqual(
    runtimeHashes(),
    config.runtimeSourceHashes,
    "Runtime changed mid-simulation; start a fresh run",
  );
  // Test-only virtual lease expiry avoids a five-minute real wait after each crash.
  // Production clocks, lease duration and budgets are untouched.
  const realNow = Date.now;
  Date.now = () => realNow() + (config.clockOffset ?? 0);
  const provider = readJson("provider.json");
  const snapshot = () => readJson("state.json") as { revision: number; state: State };
  const read = async (path: string, ref: string) => ({
    text: gitFile(path, ref),
    sha: git("rev-parse", `${ref}:${path}`),
  });
  const b = () => snapshot().state.batch!;
  const event = (kind: string, value: unknown) => {
    provider.events.push({ kind, value });
    writeJson("provider.json", provider);
  };
  const api = async <T>(path: string, method = "GET", body?: unknown): Promise<T> => {
    const input = body as Record<string, any>;
    let result: unknown;
    if (path === "/issues/1")
      result = {
        state: "open",
        labels: [{ name: "factory" }],
        body: `\`\`\`factory-batch\n${JSON.stringify(config.source)}\n\`\`\``,
      };
    else if (path === "/git/refs" && method === "POST") {
      const branch = input.ref.replace(/^refs\/heads\//, "");
      if (
        Bun.spawnSync(["git", "show-ref", "--verify", `refs/heads/${branch}`], { cwd: repo })
          .exitCode === 0
      )
        throw new GitHubError(422);
      git("update-ref", `refs/heads/${branch}`, input.sha);
      result = {};
    } else if (path.startsWith("/git/refs/heads/") && method === "PATCH") {
      git(
        "update-ref",
        `refs/heads/${decodeURIComponent(path.slice("/git/refs/heads/".length))}`,
        input.sha,
      );
      result = {};
    } else if (path.startsWith("/compare/")) {
      const [from, to] = path.slice(9).split("...");
      result = {
        status:
          Bun.spawnSync(["git", "merge-base", "--is-ancestor", from, to], { cwd: repo })
            .exitCode === 0
            ? "ahead"
            : "diverged",
        files: git("diff", "--name-only", from, to)
          .split("\n")
          .filter(Boolean)
          .map((filename) => ({ filename })),
      };
    } else if (path.startsWith("/pulls?")) result = provider.prs;
    else if (path === "/pulls" && method === "POST") {
      provider.prs.push({ html_url: "https://github.com/simulation/claimline/pull/1", ...input });
      result = provider.prs[0];
      event("draft-pr", input);
    } else if (path.startsWith("/commits/")) {
      const candidate = path.split("/")[2];
      if (!provider.ci[candidate]) {
        git("checkout", "-q", candidate);
        const receipt = await command(["bun", "run", "check-types"], `ci-${candidate}`);
        provider.ci[candidate] = {
          id: Object.keys(provider.ci).length + 1,
          name: "product-types",
          head_sha: candidate,
          status: "completed",
          conclusion: receipt.exitCode === 0 ? "success" : "failure",
          app: { slug: "github-actions" },
        };
        event("actual-ci-command", { candidate, exitCode: receipt.exitCode });
      }
      result = { total_count: 1, check_runs: [provider.ci[candidate]] };
    } else if (path.endsWith("/dispatches") && method === "POST") {
      provider.dispatches++;
      event("simulated-provider-dispatch", input);
      git("checkout", "-q", input.inputs.candidate);
      assert.equal(git("rev-parse", "HEAD"), input.inputs.candidate);
      const log = openSync(join(output, "site.log"), "a");
      const site = spawn(
        "bun",
        [
          "docs/evaluation/site.ts",
          join(output, "cert.pem"),
          join(output, "key.pem"),
          input.inputs.candidate,
        ],
        {
          cwd: repo,
          detached: true,
          stdio: ["ignore", log, log],
          env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
        },
      );
      closeSync(log);
      site.unref();
      writeJson("site.json", { pid: site.pid, candidate: input.inputs.candidate });
      let ready = false;
      for (let n = 0; n < 200; n++) {
        try {
          if ((await fetch("http://127.0.0.1:3180")).ok) {
            ready = true;
            break;
          }
        } catch {}
        await Bun.sleep(100);
      }
      if (!ready) throw new Error("Staging simulator failed to start; no success receipt");
      provider.workflow = {
        id: 100,
        display_title: input.inputs.request_id,
        status: "completed",
        conclusion: "success",
        head_sha: config.source.commit,
        head_branch: input.ref,
      };
      provider.deployments = [
        {
          id: 10,
          sha: input.inputs.candidate,
          environment: "staging",
          production_environment: false,
          creator: { login: "github-actions[bot]" },
          payload: { request_id: input.inputs.request_id, run_id: 100 },
        },
      ];
      writeJson("provider.json", provider);
      // Lost dispatch response: the same persisted identity must reconcile, never redispatch.
      if (scenario === "recovery" && !provider.crashedDeployment) {
        provider.crashedDeployment = true;
        writeJson("provider.json", provider);
        process.exit(86);
      }
      result = {};
    } else if (path.includes("/runs?"))
      result = { workflow_runs: provider.workflow ? [provider.workflow] : [] };
    else if (path.startsWith("/deployments?")) result = provider.deployments;
    else if (path === "/deployments/10") result = provider.deployments[0];
    else if (path === "/deployments/10/statuses?per_page=1")
      result = [
        {
          id: 20,
          state: "success",
          environment: "staging",
          environment_url: "https://127.0.0.1:3443",
          creator: { login: "github-actions[bot]" },
        },
      ];
    else throw new Error(`Unimplemented simulation API ${method} ${path}`);
    writeJson("provider.json", provider);
    return result as T;
  };
  await tick({
    repository: () => "simulation/claimline",
    required: () => "staging",
    file: read,
    head: async (branch) => git("rev-parse", branch),
    github: api,
    readState: async () => {
      const s = snapshot();
      return { state: s.state, sha: String(s.revision) };
    },
    saveState: async (state, previous) => {
      const s = snapshot();
      assert.equal(previous, String(s.revision), "Checkpoint CAS");
      writeJson("state.json", { revision: s.revision + 1, state });
      return String(s.revision + 1);
    },
    postReceipt: async (_issue, receipt) => {
      event("receipt", receipt);
    },
    advanceRemote: async (active) => {
      if (provider.runs[active.agentId]) return provider.runs[active.agentId];
      git("checkout", "-q", active.base);
      const current = b();
      const repairing = current.integrationRepair?.pending || current.ci?.result === "repair";
      const job = repairing
        ? repairJob(current)
        : current.deployment
          ? deployedJob(current)
          : (current.manifest.jobs.find((j) => !current.accepted.includes(j.id)) ??
            integratedJob(current));
      let result: any;
      if (active.phase === "build") {
        const source = readJson("sources.json");
        if (job.id === "queue")
          put(
            queuePath,
            scenario === "recovery"
              ? source.queue.replace(
                  "${s.caseId}",
                  "${s.caseId === 'CF-003' ? 'CF-999' : s.caseId}",
                )
              : source.queue,
          );
        else if (job.id === "detail")
          put(
            detailPath,
            source.detail + (scenario === "recovery" ? "\nconst ciProbe: string = 42;\n" : ""),
          );
        else if (job.id === "__integration_repair__") put(queuePath, source.queue);
        else if (job.id === "__ci_repair__") put(detailPath, source.detail);
        else throw new Error(`Unsupported approved repair ${job.id}`);
        git("add", queuePath, detailPath);
        git("commit", "-qm", `SIMULATED deterministic worker ${job.id}`);
        const branch = `cursor/${active.agentId}`;
        git("branch", branch);
        event("actual-git-build", {
          job: job.id,
          agent: active.agentId,
          base: active.base,
          candidate: git("rev-parse", "HEAD"),
        });
        result = {
          id: active.agentId,
          agentId: active.agentId,
          status: "FINISHED",
          git: { branches: [{ repoUrl: "https://github.com/simulation/claimline", branch }] },
        };
      } else {
        const commands = executionCommands({ ...current, active }, job);
        const receipts: Awaited<ReturnType<typeof command>>[] = [];
        for (let n = 0; n < commands.length; n++)
          receipts.push(
            await command(commands[n], `${active.agentId}-${n}`, {
              FACTORY_EXPECTED_COMMIT: active.base,
              FACTORY_CERT_SPKI: readFileSync(join(output, "spki.txt"), "utf8"),
            }),
          );
        assert.equal(
          git("status", "--porcelain"),
          "",
          "Reviewer must leave tracked files unchanged",
        );
        const passed = receipts.every((r) => r.exitCode === 0);
        const report = {
          commit: active.base,
          verdict: passed ? "approve" : "request_changes",
          unchanged: true,
          findings: passed
            ? []
            : ["Actual combined browser check failed; repair implementation within approved scope"],
          checks: receipts,
          criteria: reviewCriteria({ ...current, active }, job).map((step) => ({
            step,
            passed,
            evidence: receipts.map((r) => r.evidence).join("\n"),
          })),
        };
        const malformed =
          scenario === "recovery" &&
          ["integrated-review", "deployed-review"].includes(active.phase) &&
          !provider.malformed[active.phase];
        if (malformed) provider.malformed[active.phase] = true;
        result = {
          id: active.agentId,
          agentId: active.agentId,
          status: "FINISHED",
          result: malformed
            ? "SIMULATED provider returned prose instead of JSON"
            : JSON.stringify(report),
        };
        event("actual-verification", {
          phase: active.phase,
          job: job.id,
          candidate: active.base,
          passed,
          malformed,
        });
      }
      provider.runs[active.agentId] = result;
      writeJson("provider.json", provider);
      if (
        scenario === "recovery" &&
        active.phase === "build" &&
        job.id === "queue" &&
        !provider.crashedBuild
      ) {
        provider.crashedBuild = true;
        writeJson("provider.json", provider);
        process.exit(86); // Worker committed, coordinator has not accepted the result.
      }
      return result;
    },
  });
}

if (process.argv.includes("--tick")) await transition();
else {
  try {
    await initialize();
    let transitions = 0;
    for (; transitions < 100; transitions++) {
      const receipt = await command(
        ["bun", fileURLToPath(import.meta.url), "--output", output, "--tick"],
        `coordinator-${transitions}`,
      );
      if (receipt.exitCode === 86 && scenario === "recovery") {
        const config = readJson("config.json");
        const checkpoint = readJson("state.json").state as State;
        assert(checkpoint.lease, "Crash must leave the transition lease held");
        const before = JSON.stringify(checkpoint);
        // A duplicate wake while the lease is live must do no work or checkpoint write.
        assert.equal(
          (
            await command(
              ["bun", fileURLToPath(import.meta.url), "--output", output, "--tick"],
              `duplicate-wake-${transitions}`,
            )
          ).exitCode,
          0,
        );
        assert.equal(JSON.stringify(readJson("state.json").state), before);
        config.crashes.push({
          phase: checkpoint.batch?.active?.phase ?? "deployment-dispatch",
          candidate: checkpoint.batch?.candidate,
          agentId: checkpoint.batch?.active?.agentId,
        });
        config.clockOffset = checkpoint.lease.until - Date.now() + 1;
        writeJson("config.json", config);
        console.log(
          JSON.stringify({
            transition: transitions,
            crashRecovered: config.crashes.at(-1),
            leaseExpiry: "test-only virtual clock advance",
          }),
        );
        continue;
      }
      assert.equal(receipt.exitCode, 0, receipt.evidence);
      const state = readJson("state.json").state as State;
      console.log(
        JSON.stringify({
          transition: transitions,
          status: state.batch?.status,
          phase: state.batch?.active?.phase,
          accepted: state.batch?.accepted,
          error: state.batch?.error,
        }),
      );
      if (state.batch?.status !== "running") break;
    }
    const state = readJson("state.json").state as State;
    const provider = readJson("provider.json");
    const batch = state.batch!;
    const summary = {
      simulation: true,
      providerApis: "synthetic; no hosted API, inference, publication or spend",
      customerEvidence: "synthetic",
      coordinatorProcesses: transitions + 1,
      status: batch.status,
      error: batch.error,
      accepted: batch.accepted,
      attempts: batch.attempts,
      unreadable: batch.unreadable,
      ciRepairs: batch.ci?.repairs,
      integrationRepairs: batch.integrationRepair?.attempts,
      candidate: batch.candidate,
      deployedCandidate: batch.deployedReview?.commit,
      draftPRs: provider.prs.length,
      dispatches: provider.dispatches,
      actualVerificationRuns: provider.events.filter((e: any) => e.kind === "actual-verification")
        .length,
      coordinatorCrashes: readJson("config.json").crashes,
    };
    writeJson("summary.json", summary);
    console.log(JSON.stringify(summary, null, 2));
    assert.equal(batch.status, "mvp-complete");
    assert.deepEqual(batch.accepted, ["queue", "detail"]);
    assert.equal(batch.deployedReview?.commit, batch.candidate);
    assert.equal(provider.prs.length, 1);
    assert.equal(provider.dispatches, 1);
    assert.equal(batch.attempts.queue, 1);
    assert.equal(batch.attempts.detail, 1);
    if (scenario === "recovery") {
      assert.equal(batch.integrationRepair?.attempts, 1);
      assert.equal(batch.ci?.repairs, 1);
      assert.equal(
        Object.values(batch.unreadable ?? {}).reduce((a, b) => a + b, 0),
        2,
      );
      assert.equal(summary.coordinatorCrashes.length, 2);
    }
  } finally {
    if (existsSync(join(output, "site.json"))) {
      const { pid } = readJson("site.json");
      try {
        process.kill(-pid, "SIGTERM");
      } catch {}
    }
  }
}
