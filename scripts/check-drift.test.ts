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
      `product: demo\nclone:\n  tickets: deferred\nphases:\n  6: { name: build, status: in-progress }\n`,
    );
    writeFileSync(
      join(dir, "docs/journeys/demo.yaml"),
      `source: docs/plans/demo-design.md\nfeatures:\n  - id: F1\n    title: Clip\n    serves: [J1.S1]\n`,
    );
    writeFileSync(join(dir, "docs/plans/demo-design.md"), "# demo\n");
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

describe("the idea route", () => {
  function state(yaml: string) {
    dir = mkdtempSync(join(tmpdir(), "drift-"));
    mkdirSync(join(dir, "docs/product"), { recursive: true });
    writeFileSync(join(dir, "docs/product/state.yaml"), yaml);
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "demo" }));
    return run(dir);
  }

  test("an idea that has been shaped is the failure the loop exists to prevent", () => {
    const r = state(
      `product: demo\nsize: idea\nreframe: something\nphases:\n  3: { name: shape, status: done }\n`,
    );
    expect(r.code).toBe(1);
    expect(r.out).toContain("size is idea but phase 3 (shape) is done");
    expect(r.out).toContain("nothing to score a slice against");
  });

  test("an idea may run salvage and research", () => {
    const r = state(
      `product: demo\nsize: idea\nphases:\n  0: { name: salvage, status: blocked }\n  1: { name: research, status: done }\n  3: { name: shape, status: pending }\n`,
    );
    expect(r.out).not.toContain("size is idea but phase");
  });

  test("an idea with a site is an engagement, and says so", () => {
    const r = state(`product: demo\nsize: idea\nengagement:\n  site: North depot\nphases: {}\n`);
    expect(r.code).toBe(1);
    expect(r.out).toContain("that is an engagement");
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
    const r = state(`product: demo\nsize: idea\noutcome:\n  kind: parked\nphases: {}\n`);
    expect(r.code).toBe(1);
    expect(r.out).toContain("must say why it stopped");
  });

  test("an invented outcome kind is caught", () => {
    const r = state(
      `product: demo\nsize: idea\noutcome:\n  kind: abandoned\n  why: no customer\nphases: {}\n`,
    );
    expect(r.code).toBe(1);
    expect(r.out).toContain('outcome.kind is "abandoned"');
  });

  test("parked with a reason is clean", () => {
    const r = state(
      `product: demo\nsize: idea\noutcome:\n  kind: parked\n  why: seven vendors ship this\nphases: {}\n`,
    );
    expect(r.out).not.toContain("outcome");
  });
});
