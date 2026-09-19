#!/usr/bin/env bun
import { describe, expect, test } from "bun:test";
import { duplicateIds, type EvalCase, formatReport, runCases, summarise } from "./eval.ts";

const ok: EvalCase = { id: "PBC-15", title: "Access review ties", run: () => true };
const bad: EvalCase = {
  id: "PBC-14",
  title: "IAM list is current-state",
  steps: ["J1.S3"],
  run: () => false,
};

describe("runCases", () => {
  test("a case that returns false is a fail, not an error", async () => {
    const [o] = await runCases([bad]);
    expect(o?.status).toBe("fail");
    expect(o?.steps).toEqual(["J1.S3"]);
  });

  test("a throwing case is an error, kept separate from a low score", async () => {
    const [o] = await runCases([
      {
        id: "PBC-99",
        title: "harness broken",
        run: () => {
          throw new Error("no database");
        },
      },
    ]);
    expect(o?.status).toBe("error");
    expect(o?.detail).toBe("no database");
  });

  test("awaits async cases", async () => {
    const [o] = await runCases([{ id: "a", title: "async", run: async () => true }]);
    expect(o?.status).toBe("pass");
  });

  test("a skipped case carries its reason and never counts as a pass", async () => {
    const [o] = await runCases([
      { id: ok.id, title: ok.title, skip: "eng-side integration, out of this slice" },
    ]);
    expect(o?.status).toBe("skip");
    expect(o?.detail).toContain("out of this slice");
  });
});

describe("summarise", () => {
  test("skips leave the denominator", async () => {
    const outcomes = await runCases([ok, bad, { id: "PBC-49", title: "later one", skip: "later" }]);
    const s = summarise(outcomes);
    // 1 of 2 scored, not 1 of 1 and not 1 of 3.
    expect(s).toMatchObject({ pass: 1, fail: 1, skip: 1, scored: 2, total: 3 });
  });

  test("errors are counted so a broken harness cannot read as a good score", async () => {
    const outcomes = await runCases([
      ok,
      {
        id: "x",
        title: "boom",
        run: () => {
          throw new Error("boom");
        },
      },
    ]);
    expect(summarise(outcomes).error).toBe(1);
  });
});

describe("formatReport", () => {
  test("names the failing case and the steps it exercises", async () => {
    const out = formatReport(await runCases([ok, bad]));
    expect(out).toContain("FAIL  PBC-14");
    expect(out).toContain("J1.S3");
    expect(out).toContain("score: 1 of 2 cases handled");
  });

  test("says how many are out of scope rather than hiding them", async () => {
    const out = formatReport(await runCases([ok, { id: bad.id, title: bad.title, skip: "F3.2" }]));
    expect(out).toContain("1 out of this slice");
  });

  test("a slice that skips most of the set cannot read as a perfect score", async () => {
    const many: EvalCase[] = [
      ok,
      ...Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, title: "later one", skip: "later" })),
    ];
    const out = formatReport(await runCases(many));
    // The site has seven real cases; one is handled.
    expect(out).toContain("1 of 7 cases handled");
    expect(out).not.toContain("1/1");
  });

  test("warns that a score is unreadable when the harness failed", async () => {
    const out = formatReport(
      await runCases([
        {
          id: "x",
          title: "boom",
          run: () => {
            throw new Error("boom");
          },
        },
      ]),
    );
    expect(out).toContain("fix the harness before reading the score");
  });
});

describe("duplicateIds", () => {
  test("catches two cases claiming the same ref", () => {
    expect(duplicateIds([ok, bad, { ...ok }])).toEqual(["PBC-15"]);
  });

  test("clean set has none", () => {
    expect(duplicateIds([ok, bad])).toEqual([]);
  });
});

describe("CLI discovery failures", () => {
  test("a broken module fails instead of hiding all cases", async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(`${tmpdir()}/eval-import-`);
    try {
      mkdirSync(`${dir}/apps`);
      writeFileSync(`${dir}/apps/broken.eval.ts`, 'throw new Error("broken");');
      const child = Bun.spawn(["bun", `${import.meta.dir}/eval.ts`, "--json"], {
        cwd: dir,
        stdout: "pipe",
        stderr: "pipe",
      });
      expect(await new Response(child.stderr).text()).toContain("Cannot load eval module");
      expect(await child.exited).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  test("empty case arrays cannot certify a checkpoint", async () => {
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(`${tmpdir()}/eval-empty-`);
    try {
      const child = Bun.spawn(["bun", `${import.meta.dir}/eval.ts`, "--require-cases"], {
        cwd: dir,
        stdout: "pipe",
        stderr: "pipe",
      });
      expect(await child.exited).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
