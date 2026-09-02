import { describe, expect, it } from "bun:test";

describe("playbook hook", () => {
  it("selftest passes", async () => {
    const proc = Bun.spawn(["bun", ".cursor/hooks/playbook.ts", "selftest"], {
      cwd: import.meta.dir + "/..",
      stderr: "pipe",
      stdout: "pipe",
    });
    const [stderr, exit] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
    expect(stderr).toContain("selftest passed");
    expect(exit).toBe(0);
  });
});
