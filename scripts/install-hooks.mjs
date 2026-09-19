import { spawnSync } from "node:child_process";

// Hosted agents own their hooks; dependency installation must not replace them.
export function installHooks(cwd = process.cwd()) {
  const git = (...args) => spawnSync("git", args, { cwd, encoding: "utf8" });
  if (git("rev-parse", "--is-inside-work-tree").status !== 0) {
    console.log("Git hooks deferred until the repository is initialized.");
    return 0;
  }
  if (git("config", "--get", "core.hooksPath").stdout.trim()) {
    console.log("Keeping the existing managed Git hooks path.");
    return 0;
  }
  return (
    spawnSync(process.execPath, ["x", "lefthook", "install"], { cwd, stdio: "inherit" }).status ?? 1
  );
}
if (import.meta.main) process.exitCode = installHooks();
