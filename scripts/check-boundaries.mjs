import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { formatReport, summarizeViolations } from "./lib/boundary-report.mjs";

const repoRoot = join(import.meta.dir, "..");
const config = join(repoRoot, "tooling/dependency-cruiser/nextjs.mjs");
const appsDir = join(repoRoot, "apps");
const strict = process.argv.includes("--strict");

const entries = await readdir(appsDir);
let failed = false;
let cruised = 0;

for (const name of entries) {
  const appDir = join(appsDir, name);
  if (!(await stat(appDir)).isDirectory()) {
    continue;
  }

  const pkgFile = Bun.file(join(appDir, "package.json"));
  if (!(await pkgFile.exists())) {
    continue;
  }

  const pkg = await pkgFile.json();
  if (!pkg.dependencies?.next && !pkg.devDependencies?.next) {
    continue;
  }

  const srcDir = join(appDir, "src");
  try {
    if (!(await stat(srcDir)).isDirectory()) {
      continue;
    }
  } catch {
    continue;
  }

  cruised += 1;
  const args = ["bunx", "depcruise", "src", "--config", config, "--output-type", "json"];
  const proc = Bun.spawn(args, {
    cwd: appDir,
    stdout: "pipe",
    stderr: "inherit",
  });
  const raw = await new Response(proc.stdout).text();
  const code = await proc.exited;

  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    console.error(`${name}: dependency-cruiser did not return JSON (exit ${code}).`);
    failed = true;
    continue;
  }

  const violations = Array.isArray(report.summary?.violations) ? report.summary.violations : [];
  const summary = summarizeViolations(violations, { strict });
  if (summary.pairs.length === 0) {
    continue;
  }

  failed = true;
  console.error(`${name}:`);
  console.error(formatReport(summary, { strict }));
}

if (cruised === 0) {
  console.error("No Next.js apps with src/ found under apps/.");
  process.exit(1);
}

if (failed) {
  process.exit(1);
}
