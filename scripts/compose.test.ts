#!/usr/bin/env bun
import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const script = join(root, "scripts/compose.mjs");
const recipe = join(root, "docs/kit/recipe.yaml");
let dir: string | null = null;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = null;
});

function run(argv: string[], cwd = root) {
  try {
    return {
      code: 0,
      out: execFileSync("bun", [script, ...argv], { cwd, encoding: "utf8" }),
    };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

describe("compose", () => {
  test("catalog lists Next, shadcn, Eve, and Neon regions", () => {
    const r = run([]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("compose catalog");
    expect(r.out).toContain("create-next-app@latest");
    expect(r.out).toContain("shadcn@latest");
    expect(r.out).toContain("eve@latest");
    expect(r.out).toContain("aws-eu-central-1");
    expect(r.out).toContain("aws-ap-southeast-1");
    expect(r.out).toContain("feature-folders");
  });

  test("--add web implies ui and skips Eve", () => {
    const r = run(["--add", "web"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("compose plan");
    expect(r.out).toContain("surfaces: web, ui");
    expect(r.out).toContain("create-next-app@latest");
    expect(r.out).toContain("shadcn@latest");
    expect(r.out).toContain("@clerk/nextjs");
    expect(r.out).not.toContain("eve@latest");
  });

  test("--add agent is Eve only", () => {
    const r = run(["--add", "agent"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("eve@latest");
    expect(r.out).not.toContain("create-next-app@latest");
    expect(r.out).toContain("judgment-gate");
    expect(r.out).toContain("skip Neon");
    expect(r.out).not.toContain("neonctl");
  });

  test("--without auth drops Clerk", () => {
    const r = run(["--add", "web", "--without", "auth"]);
    expect(r.code).toBe(0);
    expect(r.out).not.toContain("@clerk/nextjs");
    expect(r.out).toContain("workflow");
    expect(r.out).toContain("skip Clerk");
  });

  test("unknown surface fails", () => {
    const r = run(["--add", "prisma"]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("unknown surface prisma");
  });

  test("--apply refuses on the kit", () => {
    const r = run(["--add", "web", "--apply"]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("vipernxt");
  });

  test("--apply writes composed.yaml on a named clone", () => {
    dir = mkdtempSync(join(tmpdir(), "compose-"));
    mkdirSync(join(dir, "docs/kit"), { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "acme" }));
    writeFileSync(join(dir, "docs/kit/recipe.yaml"), readFileSync(recipe, "utf8"));
    const overlaySrc = join(root, "docs/kit/overlays/web/src/env.ts");
    mkdirSync(join(dir, "docs/kit/overlays/web/src"), { recursive: true });
    writeFileSync(join(dir, "docs/kit/overlays/web/src/env.ts"), readFileSync(overlaySrc, "utf8"));
    const r = run(["--cwd", dir, "--add", "web", "--add", "db", "--apply"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("wrote");
    expect(r.out).toContain("overlay web → apps/web");
    expect(existsSync(join(dir, "apps/web/src/env.ts"))).toBe(true);
    const composed = readFileSync(join(dir, "docs/kit/composed.yaml"), "utf8");
    expect(composed).toContain("web");
    expect(composed).toContain("db");
    expect(composed).toContain("create-next-app@latest");
  });

  test("--apply without auth does not require Clerk in env.ts", () => {
    dir = mkdtempSync(join(tmpdir(), "compose-"));
    mkdirSync(join(dir, "docs/kit"), { recursive: true });
    mkdirSync(join(dir, "docs/product"), { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "acme" }));
    writeFileSync(join(dir, "docs/kit/recipe.yaml"), readFileSync(recipe, "utf8"));
    writeFileSync(
      join(dir, "docs/product/state.yaml"),
      "clone:\n  customized: done\n  composed: pending\n",
    );
    mkdirSync(join(dir, "docs/kit/overlays/web/src"), { recursive: true });
    writeFileSync(join(dir, "docs/kit/overlays/web/src/env.ts"), "PLACEHOLDER\n");
    mkdirSync(join(dir, "docs/kit/overlays/agent"), { recursive: true });
    writeFileSync(join(dir, "docs/kit/overlays/agent/AGENTS.md"), "# agent\n");
    const r = run([
      "--cwd",
      dir,
      "--add",
      "web",
      "--add",
      "agent",
      "--without",
      "auth",
      "--without",
      "jobs",
      "--apply",
    ]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("overlay agent → apps/agent");
    expect(existsSync(join(dir, "apps/agent/AGENTS.md"))).toBe(true);
    const env = readFileSync(join(dir, "apps/web/src/env.ts"), "utf8");
    expect(env).not.toContain("CLERK");
    expect(env).not.toContain("DATABASE_URL");
    const state = readFileSync(join(dir, "docs/product/state.yaml"), "utf8");
    expect(state).toContain("composed: done");
  });
});
