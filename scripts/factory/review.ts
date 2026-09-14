/** Independent read-only Codex review. Findings fail the stage even when Codex exits zero. */
import { spawn } from "node:child_process";
import { join } from "node:path";
import type { Request } from "./attempt";
import { read, save } from "./core";

// biome-ignore lint/suspicious/noUndeclaredEnvVars: direct supervisor subprocess, not a cached Turbo task
const directory = process.env.FACTORY_ATTEMPT_DIR;
if (!directory) throw new Error("Review must run inside a factory attempt");
const request = read<Request>(join(directory, "request.json"));
const schema = join(directory, "review-schema.json");
const output = join(directory, "review.json");
save(schema, {
  type: "object",
  properties: {
    approved: { type: "boolean" },
    findings: { type: "array", items: { type: "string" } },
  },
  required: ["approved", "findings"],
  additionalProperties: false,
});
const proc = spawn(
  request.manifest.worker.executable ?? "codex",
  [
    "exec",
    "--json",
    "--ephemeral",
    "--sandbox",
    "read-only",
    "-c",
    'approval_policy="never"',
    "--output-schema",
    schema,
    "--output-last-message",
    output,
    "-",
  ],
  { cwd: request.worktree, stdio: ["pipe", "inherit", "inherit"] },
);
proc.stdin?.end(
  `Review this slice against its contract and the diff from ${request.base}, including staged/untracked files. Do not edit files. Approve only if no actionable correctness, security or acceptance defects remain. Return approved=false with concrete findings otherwise. Do not infer success from the builder's summary.\n${JSON.stringify(request.job)}`,
);
const code = await new Promise<number | null>((resolve, reject) => {
  proc.once("error", reject);
  proc.once("exit", resolve);
});
if (code !== 0) throw new Error(`Reviewer exited ${code}`);
const result = read<{ approved: boolean; findings: string[] }>(output);
if (result.approved !== true || !Array.isArray(result.findings) || result.findings.length > 0) {
  console.error(JSON.stringify(result));
  process.exitCode = 1;
}
