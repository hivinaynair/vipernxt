import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installHooks } from "./install-hooks.mjs";

test("dependency install preserves provider-managed hooks", () => {
  const root = mkdtempSync(join(tmpdir(), "managed-hooks-"));
  try {
    execFileSync("git", ["init", "-q", root]);
    const hooks = join(root, "provider-hooks");
    mkdirSync(hooks);
    writeFileSync(join(hooks, "pre-commit"), "provider-owned");
    execFileSync("git", ["config", "core.hooksPath", hooks], { cwd: root });
    expect(installHooks(root)).toBe(0);
    expect(readFileSync(join(hooks, "pre-commit"), "utf8")).toBe("provider-owned");
    expect(
      execFileSync("git", ["config", "core.hooksPath"], { cwd: root, encoding: "utf8" }).trim(),
    ).toBe(hooks);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("archive setup can finish before git init", () => {
  const root = mkdtempSync(join(tmpdir(), "uninitialized-hooks-"));
  try {
    expect(installHooks(root)).toBe(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
