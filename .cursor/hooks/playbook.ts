#!/usr/bin/env bun
/**
 * Playbook harness hooks.
 *
 * Commands (stdout is JSON for Cursor; diagnostics go to stderr):
 *
 *   gate      preToolUse — deny product UI/route/feature writes until shape is done
 *   branch    beforeShellExecution — deny pushes to main and unsafe force-pushes
 *   session   sessionStart — inject the pipeline digest as additional_context
 *   selftest  run fixtures; exit 1 on failure
 *
 * Repo root is two levels above this file. Cloud and local checkouts both work.
 *
 * This was Python once, with a hand-written YAML subset parser attached, because
 * a gate that guards the build must not depend on a library being installed.
 * Bun parses YAML natively and the repo refuses to install with anything else
 * (`only-allow bun`, `engines.bun`), so the parser is gone and the dependency is
 * one the repo already had. The gate stays fail-closed: if bun is missing the
 * hook errors, and an erroring gate denies.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(Bun.fileURLToPath(import.meta.url)), "..", "..");
const STATE_PATH = join(ROOT, "docs", "product", "state.yaml");
const GATED_FRAGMENTS = ["/src/app/", "/src/features/"] as const;

const PLAYBOOK_SKILLS = [
  "next",
  "status",
  "plan",
  "build",
  "artifacts",
  "journeys",
  "design-system",
  "shape",
  "salvage",
  "setup",
  "customize",
  "ontology",
  "prototype",
  "field-kit",
  "linear-sync",
] as const;

type State = Record<string, unknown>;
type Phase = Record<string, unknown> & { _key?: string };

function emit(payload: unknown): void {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

async function readStdin(): Promise<string> {
  try {
    return await Bun.stdin.text();
  } catch {
    return "";
  }
}

/** Parsed state, {} when there is no file, null when it cannot be read. */
export function loadState(text?: string): State | null {
  let raw = text;
  if (raw === undefined) {
    if (!existsSync(STATE_PATH)) return {};
    try {
      raw = readFileSync(STATE_PATH, "utf8");
    } catch {
      return null;
    }
  }
  try {
    const data = Bun.YAML.parse(raw) ?? {};
    if (typeof data !== "object" || Array.isArray(data)) return null;
    return data as State;
  } catch {
    return null;
  }
}

function phaseEntries(state: State): Phase[] {
  const raw = state.phases;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.entries(raw as Record<string, unknown>)
    .filter(([, v]) => v && typeof v === "object" && !Array.isArray(v))
    .map(([key, v]) => ({ ...(v as Record<string, unknown>), _key: key }));
}

function namedPhase(state: State, name: string): Phase | undefined {
  return phaseEntries(state).find((e) => String(e.name ?? "") === name);
}

function shapeDone(state: State): boolean {
  return String(namedPhase(state, "shape")?.status ?? "") === "done";
}

function uiWritesOverride(state: State): "allow" | "deny" | null {
  const raw = state.ui_writes;
  if (raw === undefined || raw === null) return null;
  const value = String(raw).trim().toLowerCase();
  return value === "allow" || value === "deny" ? value : null;
}

/** Whether product UI writes are allowed. No state file means boilerplate: allowed. */
export function uiWritesAllowed(state: State | null): [boolean, string] {
  if (state === null) {
    return [false, "docs/product/state.yaml is unreadable; refusing product UI writes"];
  }
  if (Object.keys(state).length === 0) {
    return [true, "no product pipeline; boilerplate edits allowed"];
  }
  const override = uiWritesOverride(state);
  if (override === "allow") return [true, "ui_writes: allow"];
  if (override === "deny") return [false, "ui_writes: deny"];
  if (shapeDone(state)) return [true, "shape is done; design doc is approved"];
  return [false, "design doc is not approved (shape is not done)"];
}

function collectPaths(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) collectPaths(item, out);
    return out;
  }
  for (const [key, value] of Object.entries(node)) {
    if (
      typeof value === "string" &&
      ["path", "file_path", "filePath", "target_notebook"].includes(key)
    ) {
      out.push(value);
    } else {
      collectPaths(value, out);
    }
  }
  return out;
}

function isGatedPath(path: string): boolean {
  let normalized = path.replaceAll("\\", "/");
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  return GATED_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

export function gateFromPayload(payload: Record<string, unknown>, state: State | null) {
  const toolInput = payload.tool_input ?? payload.input ?? {};
  const gated = collectPaths(toolInput).filter(isGatedPath);
  if (gated.length === 0) return { permission: "allow" };

  const [allowed, reason] = uiWritesAllowed(state);
  if (allowed) return { permission: "allow" };

  return {
    permission: "deny",
    user_message: `Product UI/routes/features are blocked until the design doc is approved. ${reason}.`,
    agent_message:
      "HOOK-DENY: writes under apps/*/src/app or apps/*/src/features are blocked " +
      `until shape is done (or ui_writes: allow). ${reason}. ` +
      "Do not retry the same edit or bypass it with the shell. " +
      "Work in docs/product, docs/plans, docs/journeys, or docs/research instead.",
  };
}

// Commands an agent must not run. The human can still run any of them by hand —
// that is the point. A release is a person's decision, not a slice's side effect.
const BRANCH_RULES: [RegExp, string][] = [
  [
    /\bgit\s+push\b(?=.*\bmain\b)/,
    "PRs target staging; main is production. Push to staging, then a human merges " +
      "staging into main. A hotfix onto main is theirs to run, not yours.",
  ],
  [
    /\bgh\s+pr\s+create\b(?=.*--base[= ]+main\b)/,
    "Open the PR against staging. main only ever receives a staging merge.",
  ],
  [
    /\bgit\s+push\b(?=.*(?:--force|-f)\b)(?!.*--force-with-lease)/,
    "Use --force-with-lease, and only on your own slice branch.",
  ],
];

export function branchFromCommand(command: string) {
  for (const [pattern, why] of BRANCH_RULES) {
    if (pattern.test(command)) {
      return {
        permission: "deny",
        user_message: `Blocked: ${command}`,
        agent_message:
          `${why} Do not work around this with another command — ` +
          "tell the user what you wanted to run and why.",
      };
    }
  }
  return { permission: "allow" };
}

const HARNESS_NOTE =
  "Harness: if next/status/shape are missing from your skill list, read " +
  ".agents/skills/<name>/SKILL.md (also .cursor/skills/) and say the catalog omitted them.";

async function cmdSession(): Promise<number> {
  await readStdin();
  let digest = "";
  try {
    const result = Bun.spawnSync(["bun", "scripts/status.ts"], { cwd: ROOT });
    digest = result.stdout.toString().trim();
  } catch {
    digest = "";
  }
  if (!digest) digest = "Could not render the pipeline digest — run `bun scripts/status.ts`.";
  emit({ additional_context: `${digest}\n\n${HARNESS_NOTE}` });
  return 0;
}

async function cmdGate(): Promise<number> {
  const raw = await readStdin();
  let payload: Record<string, unknown> = {};
  try {
    const parsed = raw.trim() ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed;
  } catch {
    payload = {};
  }
  emit(gateFromPayload(payload, loadState()));
  return 0;
}

async function cmdBranch(): Promise<number> {
  const raw = await readStdin();
  let command = "";
  try {
    const parsed = raw.trim() ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object") command = String(parsed.command ?? "");
  } catch {
    command = "";
  }
  emit(branchFromCommand(command));
  return 0;
}

function cmdSelftest(): number {
  const failures: string[] = [];
  const check = (name: string, got: unknown, expected: unknown) => {
    if (got !== expected)
      failures.push(`${name}: got ${JSON.stringify(got)} expected ${JSON.stringify(expected)}`);
  };

  const pending = loadState("phase: 3\nphases:\n  3: { name: shape, status: pending }\n");
  const done = loadState(
    "phase: 4\nphases:\n  3: { name: shape, status: done }\n  4: { name: journeys, status: in-progress }\n",
  );
  const denyOverride = loadState("ui_writes: deny\nphases:\n  3: { name: shape, status: done }\n");
  const allowOverride = loadState(
    "ui_writes: allow\nphases:\n  3: { name: shape, status: pending }\n",
  );

  const payload = (path: string) => ({ tool_name: "StrReplace", tool_input: { path } });
  const app = "/workspace/apps/web/src/app/page.tsx";
  const feat = "apps/web/src/features/bookings/ui.tsx";
  const envp = "/workspace/apps/web/src/env.ts";
  const readme = "/workspace/README.md";

  check("no-state app allow", gateFromPayload(payload(app), {}).permission, "allow");
  check("pending shape app deny", gateFromPayload(payload(app), pending).permission, "deny");
  check("pending shape feature deny", gateFromPayload(payload(feat), pending).permission, "deny");
  check("pending shape env allow", gateFromPayload(payload(envp), pending).permission, "allow");
  check(
    "pending shape readme allow",
    gateFromPayload(payload(readme), pending).permission,
    "allow",
  );
  check("shape done app allow", gateFromPayload(payload(app), done).permission, "allow");
  check("ui_writes deny wins", gateFromPayload(payload(app), denyOverride).permission, "deny");
  check("ui_writes allow wins", gateFromPayload(payload(app), allowOverride).permission, "allow");
  check("unreadable yaml fail-closed", gateFromPayload(payload(app), null).permission, "deny");

  const branch = (command: string) => branchFromCommand(command).permission;
  check("push to main denied", branch("git push origin main"), "deny");
  check("push HEAD:main denied", branch("git push origin HEAD:main"), "deny");
  check("push staging allowed", branch("git push origin HEAD:staging"), "allow");
  check("slice branch allowed", branch("git push -u origin agent/f2-1-reconciliation"), "allow");
  check("pr base main denied", branch("gh pr create --base main --title x"), "deny");
  check("pr base staging allowed", branch("gh pr create --base staging --title x"), "allow");
  check("bare force denied", branch("git push --force origin my-branch"), "deny");
  check(
    "force-with-lease allowed",
    branch("git push --force-with-lease origin my-branch"),
    "allow",
  );
  check("unrelated command allowed", branch("bun test"), "allow");
  check("empty command allowed", branch(""), "allow");

  // The YAML is real now, so malformed input must still fail closed rather than throw.
  check("malformed yaml is null", loadState("phases:\n  - [unclosed\n"), null);
  check("scalar yaml is null", loadState("just a string\n"), null);

  if (failures.length > 0) {
    process.stderr.write("selftest failed:\n");
    for (const line of failures) process.stderr.write(`  ${line}\n`);
    return 1;
  }
  process.stderr.write(`selftest passed (${PLAYBOOK_SKILLS.length} playbook skills recorded)\n`);
  return 0;
}

const cmd = process.argv[2] ?? "";
if (cmd === "gate") process.exit(await cmdGate());
else if (cmd === "branch") process.exit(await cmdBranch());
else if (cmd === "session") process.exit(await cmdSession());
else if (cmd === "selftest") process.exit(cmdSelftest());
else {
  process.stderr.write("usage: playbook.ts gate|branch|session|selftest\n");
  process.exit(2);
}
