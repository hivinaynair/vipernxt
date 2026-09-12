#!/usr/bin/env bun
import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const script = join(root, "scripts/check-drift.ts");
let dir: string | null = null;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = null;
});

function run(cwd: string) {
  try {
    return {
      code: 0,
      out: execFileSync("bun", [script], { cwd, encoding: "utf8" }),
    };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

describe("check-drift", () => {
  test("clean when no product state", () => {
    dir = mkdtempSync(join(tmpdir(), "drift-"));
    const r = run(dir);
    expect(r.code).toBe(0);
    expect(r.out).toContain("no product state");
  });

  test("flags idea_outdated", () => {
    dir = mkdtempSync(join(tmpdir(), "drift-"));
    mkdirSync(join(dir, "docs/product"), { recursive: true });
    writeFileSync(
      join(dir, "docs/product/state.yaml"),
      `product: demo\nidea: runs on paper\nidea_outdated: true\nphases: {}\n`,
    );
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "demo" }));
    const r = run(dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("idea_outdated");
  });

  test("flags shape done without reframe", () => {
    dir = mkdtempSync(join(tmpdir(), "drift-"));
    mkdirSync(join(dir, "docs/product"), { recursive: true });
    writeFileSync(
      join(dir, "docs/product/state.yaml"),
      `product: demo\nphases:\n  3: { name: shape, status: done }\n`,
    );
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "demo" }));
    const r = run(dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("reframe");
  });

  test("tickets deferred does not require Linear ids", () => {
    dir = mkdtempSync(join(tmpdir(), "drift-"));
    mkdirSync(join(dir, "docs/product"), { recursive: true });
    mkdirSync(join(dir, "docs/journeys"), { recursive: true });
    mkdirSync(join(dir, "docs/plans"), { recursive: true });
    writeFileSync(
      join(dir, "docs/product/state.yaml"),
      `product: demo\nengagement:\n  site: North depot\n  baseline: "6 days"\neval_set: docs/research/eval-set.md\nclone:\n  tickets: deferred\nphases:\n  6: { name: build, status: in-progress }\n`,
    );
    writeFileSync(
      join(dir, "docs/journeys/demo.yaml"),
      `source: docs/plans/demo-design.md\nfeatures:\n  - id: F1\n    title: Clip\n    serves: [J1.S1]\n`,
    );
    writeFileSync(join(dir, "docs/plans/demo-design.md"), "# demo\n");
    mkdirSync(join(dir, "docs/research"), { recursive: true });
    writeFileSync(join(dir, "docs/research/eval-set.md"), "# cases\n");
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "demo" }));
    const r = run(dir);
    expect(r.code).toBe(0);
    expect(r.out).toContain("no drift");
  });

  test("flags unknown clip kind", () => {
    dir = mkdtempSync(join(tmpdir(), "drift-"));
    mkdirSync(join(dir, "docs/product"), { recursive: true });
    writeFileSync(
      join(dir, "docs/product/state.yaml"),
      `product: demo\nclip:\n  kind: rebuild\nphases: {}\n`,
    );
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "demo" }));
    const r = run(dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("clip.kind");
  });

  test("flags composed without surfaces", () => {
    dir = mkdtempSync(join(tmpdir(), "drift-"));
    mkdirSync(join(dir, "docs/product"), { recursive: true });
    writeFileSync(
      join(dir, "docs/product/state.yaml"),
      `product: demo\nclone:\n  composed: done\nphases: {}\n`,
    );
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "demo" }));
    const r = run(dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("surfaces is empty");
  });

  test("flags a surface missing from composed.yaml", () => {
    dir = mkdtempSync(join(tmpdir(), "drift-"));
    mkdirSync(join(dir, "docs/product"), { recursive: true });
    mkdirSync(join(dir, "docs/kit"), { recursive: true });
    writeFileSync(
      join(dir, "docs/product/state.yaml"),
      `product: demo\nclip:\n  kind: wrap\nsurfaces: [web, agent]\nclone:\n  composed: done\nphases: {}\n`,
    );
    writeFileSync(join(dir, "docs/kit/composed.yaml"), "surfaces: [web, ui]\n");
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "demo" }));
    const r = run(dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("agent");
    expect(r.out).toContain("composed.yaml");
  });
});

describe("the entry condition", () => {
  function state(yaml: string) {
    dir = mkdtempSync(join(tmpdir(), "drift-"));
    mkdirSync(join(dir, "docs/product"), { recursive: true });
    writeFileSync(join(dir, "docs/product/state.yaml"), yaml);
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "demo" }));
    return run(dir);
  }

  test("work without a named customer is the failure the loop exists to prevent", () => {
    const r = state(
      `product: demo\nreframe: something\nphases:\n  3: { name: shape, status: done }\n`,
    );
    expect(r.code).toBe(1);
    expect(r.out).toContain("phase 3 (shape) is done but no engagement.site is named");
    expect(r.out).toContain("nothing to score a slice against");
  });

  test("salvage and research may run before a customer is named", () => {
    const r = state(
      `product: demo\nphases:\n  0: { name: salvage, status: blocked }\n  1: { name: research, status: done }\n  3: { name: shape, status: pending }\n`,
    );
    expect(r.out).not.toContain("no engagement.site is named");
  });

  test("a placeholder reframe does not count as confirmed", () => {
    const r = state(
      `product: demo\nengagement:\n  site: North depot\nreframe: PENDING — not written yet\nphases:\n  3: { name: shape, status: done }\n`,
    );
    expect(r.code).toBe(1);
    expect(r.out).toContain("reads as a placeholder");
  });

  test("build without an eval set has nothing to score against", () => {
    const r = state(
      `product: demo\nengagement:\n  site: North depot\n  baseline: "6 days"\nphases:\n  6: { name: build, status: in-progress }\n`,
    );
    expect(r.code).toBe(1);
    expect(r.out).toContain("no eval_set is named");
  });

  test("build before the spine is expanded is drift", () => {
    const r = state(
      `product: demo\nengagement:\n  site: North depot\n  baseline: "6 days"\neval_set: docs/product/state.yaml\nphases:\n  4: { name: journeys, status: pending }\n  6: { name: build, status: in-progress }\n`,
    );
    expect(r.code).toBe(1);
    expect(r.out).toContain("earlier phase 4 (journeys) is still pending");
  });

  test("structure after the first slice is not out of order", () => {
    const r = state(
      `product: demo\nengagement:\n  site: North depot\n  baseline: "6 days"\neval_set: docs/product/state.yaml\nphases:\n  5a: { name: structure, status: pending }\n  6: { name: build, status: in-progress }\n`,
    );
    expect(r.out).not.toContain("structure");
  });

  test("a pivoted clip whose eval set was not re-derived is drift", () => {
    const r = state(
      `product: demo\nengagement:\n  site: North depot\n  baseline: "6 days"\neval_set: docs/product/state.yaml\nclone:\n  tickets: deferred\nphases:\n  6: { name: build, status: in-progress }\n`,
    );
    mkdirSync(join(dir, "docs/journeys"), { recursive: true });
    mkdirSync(join(dir, "docs/plans"), { recursive: true });
    mkdirSync(join(dir, "packages/eval"), { recursive: true });
    writeFileSync(join(dir, "docs/plans/d.md"), "# d\n");
    writeFileSync(
      join(dir, "docs/journeys/s.yaml"),
      `source: docs/plans/d.md\njourneys:\n  - id: J1\n    title: Old clip\n    steps:\n      - id: J1.S1\n  - id: J3\n    title: New clip\n    steps:\n      - id: J3.S1\nfeatures:\n  - id: F1\n    title: F\n    serves: [J1.S1, J3.S1]\n`,
    );
    writeFileSync(
      join(dir, "packages/eval/a.eval.ts"),
      'const c = ["J1.S1"];\nexport default c;\n',
    );
    const r2 = run(dir);
    expect(r2.code).toBe(1);
    expect(r2.out).toContain("journey J3 (New clip)");
    expect(r2.out).toContain("measures a different clip");
    expect(r2.out).not.toContain("journey J1");
    void r;
  });

  test("idea is no longer a size", () => {
    const r = state(`product: demo\nsize: idea\nphases: {}\n`);
    expect(r.code).toBe(1);
    expect(r.out).toContain('size is "idea"');
  });

  test("a design doc confirmed by nobody is drift, whatever size says", () => {
    // The guard does not depend on `size` being filled in — that was how an
    // idea slipped through as an engagement in the first place.
    const r = state(
      `product: demo\nreframe: something\nphases:\n  3: { name: shape, status: done }\n`,
    );
    expect(r.code).toBe(1);
    expect(r.out).toContain("no engagement.site is named");
  });

  test("shape done with a site is clean", () => {
    const r = state(
      `product: demo\nsize: engagement\nreframe: something\nengagement:\n  site: North depot\nphases:\n  3: { name: shape, status: done }\n`,
    );
    expect(r.out).not.toContain("engagement.site is named");
  });

  test("a misspelled size is caught", () => {
    const r = state(`product: demo\nsize: engagment\nphases: {}\n`);
    expect(r.code).toBe(1);
    expect(r.out).toContain('size is "engagment"');
  });

  test("engagement is still clean", () => {
    const r = state(`product: demo\nsize: engagement\nphases: {}\n`);
    expect(r.out).not.toContain("size is");
  });
});

describe("outcome", () => {
  function state(yaml: string) {
    dir = mkdtempSync(join(tmpdir(), "drift-"));
    mkdirSync(join(dir, "docs/product"), { recursive: true });
    writeFileSync(join(dir, "docs/product/state.yaml"), yaml);
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "demo" }));
    return run(dir);
  }

  test("a stopped engagement must say why", () => {
    const r = state(`product: demo\noutcome:\n  kind: parked\nphases: {}\n`);
    expect(r.code).toBe(1);
    expect(r.out).toContain("must say why it stopped");
  });

  test("an invented outcome kind is caught", () => {
    const r = state(`product: demo\noutcome:\n  kind: abandoned\n  why: no customer\nphases: {}\n`);
    expect(r.code).toBe(1);
    expect(r.out).toContain('outcome.kind is "abandoned"');
  });

  test("parked with a reason is clean", () => {
    const r = state(
      `product: demo\noutcome:\n  kind: parked\n  why: seven vendors ship this\nphases: {}\n`,
    );
    expect(r.out).not.toContain("outcome");
  });
});
