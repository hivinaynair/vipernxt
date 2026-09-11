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
});
