import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertBunTargets } from "../agent/lib/bun-targets.js";

test("intake rejects a Bun filter that silently skips a failing pinned evaluator", async () => {
  const directory = await mkdtemp(join(tmpdir(), "factory-bun-target-"));
  try {
    await writeFile(
      join(directory, "fixture.test.ts"),
      'import {test} from "bun:test"; test("discovered fixture",()=>{});',
    );
    await writeFile(
      join(directory, "selection.eval.ts"),
      'import {test} from "bun:test"; test("pinned evaluator executed",()=>{throw Error("actual acceptance failure")});',
    );
    const run = async (args: string[]) => {
      const child = Bun.spawn([process.execPath, "test", ...args], {
        cwd: directory,
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr, code] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      return { output: stdout + stderr, code };
    };
    const skipped = await run(["fixture.test.ts", "selection.eval.ts"]);
    expect(skipped.code).toBe(0);
    expect(skipped.output).not.toContain("pinned evaluator executed");
    expect(() =>
      assertBunTargets(
        ["bun", "test", "fixture.test.ts", "selection.eval.ts"],
        ["selection.eval.ts"],
      ),
    ).toThrow("explicit path");
    const explicit = ["bun", "test", "fixture.test.ts", "./selection.eval.ts"];
    expect(() => assertBunTargets(explicit, ["selection.eval.ts"])).not.toThrow();
    const executed = await run(explicit.slice(2));
    expect(executed.code).toBe(1);
    expect(executed.output).toContain("pinned evaluator executed");
    expect(executed.output).toContain("actual acceptance failure");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
