import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setupClerk } from "./lib/setup-clerk";

test("provisioning resumes after env failure without creating twice", async () => {
  const root = mkdtempSync(join(tmpdir(), "clerk-"));
  const calls: string[][] = [];
  let fail = true;
  const run = async (args: string[]) => {
    calls.push(args);
    if (args[0] === "whoami") return JSON.stringify({ email: "test@example.com", linked: null });
    if (args[0] === "apps") return JSON.stringify({ application_id: "app_fixture" });
    if (args[0] === "env" && fail) throw new Error("network");
    return "{}";
  };
  try {
    await expect(setupClerk(root, "test", undefined, run)).rejects.toThrow("network");
    fail = false;
    expect(await setupClerk(root, "test", undefined, run)).toBe("app_fixture");
    expect(calls.filter((c) => c[0] === "apps")).toHaveLength(1);
    expect(calls.at(-1)).toEqual([
      "env",
      "pull",
      "--app",
      "app_fixture",
      "--instance",
      "dev",
      "--file",
      ".env.local",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("uncertain creation blocks duplicates until explicit reconciliation", async () => {
  const root = mkdtempSync(join(tmpdir(), "clerk-"));
  let creates = 0;
  const run = async (args: string[]) => {
    if (args[0] === "whoami") return '{"email":"test@example.com"}';
    if (args[0] === "apps") {
      creates++;
      throw new Error("timeout");
    }
    return "{}";
  };
  try {
    await expect(setupClerk(root, "test", undefined, run)).rejects.toThrow("timeout");
    await expect(setupClerk(root, "test", undefined, run)).rejects.toThrow("uncertain");
    expect(await setupClerk(root, "test", "app_reconciled", run)).toBe("app_reconciled");
    expect(creates).toBe(1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
