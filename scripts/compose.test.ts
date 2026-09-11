#!/usr/bin/env bun
import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
  test("catalog lists Next, Eve, and Neon regions", () => {
    const r = run([]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("compose catalog");
    expect(r.out).toContain("create-next-app@latest");
    expect(r.out).toContain("eve@latest");
    expect(r.out).toContain("--cwd packages/db");
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
    // ui is scaffolded by the overlay, not by a CLI — see the "ui surface" tests.
    expect(r.out).toContain("bun run ui:add --");
    expect(r.out).toContain("@clerk/nextjs");
    expect(r.out).toContain("posthog-js");
    expect(r.out).toContain("resend");
    expect(r.out).toContain("@vercel/blob");
    expect(r.out).toContain("--cwd apps/web");
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

  test("--without analytics, email, files drops those packages", () => {
    const r = run([
      "--add",
      "web",
      "--without",
      "analytics",
      "--without",
      "email",
      "--without",
      "files",
    ]);
    expect(r.code).toBe(0);
    expect(r.out).not.toContain("posthog-js");
    expect(r.out).not.toContain("resend");
    expect(r.out).not.toContain("@vercel/blob");
    expect(r.out).toContain("skip PostHog");
    expect(r.out).toContain("skip Resend");
    expect(r.out).toContain("skip Blob");
  });

  test("unknown surface fails", () => {
    const r = run(["--add", "prisma"]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("unknown surface prisma");
  });

  test("--apply refuses on the kit", () => {
    // In a temp dir, not the repo root. Run against the repo this passed on the
    // kit (blocked by the name guard) and silently rewrote docs/kit/composed.yaml
    // on any renamed clone — so `bun test` inside a product clobbered its own
    // compose record, and check-drift then reported surfaces that had gone missing.
    dir = mkdtempSync(join(tmpdir(), "compose-"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "vipernxt" }));
    const r = run(["--cwd", dir, "--add", "web", "--apply"]);
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
    expect(env).toContain("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN");
    expect(env).toContain("RESEND_API_KEY");
    expect(env).toContain("BLOB_READ_WRITE_TOKEN");
    const state = readFileSync(join(dir, "docs/product/state.yaml"), "utf8");
    expect(state).toContain("composed: done");
  });

  test("--apply copies PostHog, Resend, and Blob overlays", () => {
    dir = mkdtempSync(join(tmpdir(), "compose-"));
    mkdirSync(join(dir, "docs/kit"), { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "acme" }));
    writeFileSync(join(dir, "docs/kit/recipe.yaml"), readFileSync(recipe, "utf8"));
    for (const name of ["web", "analytics", "email", "files"]) {
      cpSync(join(root, "docs/kit/overlays", name), join(dir, "docs/kit/overlays", name), {
        recursive: true,
      });
    }
    const r = run(["--cwd", dir, "--add", "web", "--apply"]);
    expect(r.code).toBe(0);
    expect(existsSync(join(dir, "apps/web/src/instrumentation-client.ts"))).toBe(true);
    expect(existsSync(join(dir, "apps/web/src/shared/posthog-server.ts"))).toBe(true);
    expect(existsSync(join(dir, "apps/web/src/shared/email.ts"))).toBe(true);
    expect(existsSync(join(dir, "apps/web/src/shared/blob.ts"))).toBe(true);
    expect(existsSync(join(dir, "apps/web/src/app/global-error.tsx"))).toBe(true);
    expect(r.out).toContain("overlay analytics → apps/web");
    expect(r.out).toContain("overlay email → apps/web");
    expect(r.out).toContain("overlay files → apps/web");
  });

  test("--apply --without analytics,email,files skips those overlays", () => {
    dir = mkdtempSync(join(tmpdir(), "compose-"));
    mkdirSync(join(dir, "docs/kit"), { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "acme" }));
    writeFileSync(join(dir, "docs/kit/recipe.yaml"), readFileSync(recipe, "utf8"));
    for (const name of ["web", "analytics", "email", "files"]) {
      cpSync(join(root, "docs/kit/overlays", name), join(dir, "docs/kit/overlays", name), {
        recursive: true,
      });
    }
    const r = run([
      "--cwd",
      dir,
      "--add",
      "web",
      "--without",
      "analytics",
      "--without",
      "email",
      "--without",
      "files",
      "--apply",
    ]);
    expect(r.code).toBe(0);
    expect(existsSync(join(dir, "apps/web/src/instrumentation-client.ts"))).toBe(false);
    expect(existsSync(join(dir, "apps/web/src/shared/email.ts"))).toBe(false);
    expect(existsSync(join(dir, "apps/web/src/shared/blob.ts"))).toBe(false);
    const env = readFileSync(join(dir, "apps/web/src/env.ts"), "utf8");
    expect(env).not.toContain("POSTHOG");
    expect(env).not.toContain("RESEND");
    expect(env).not.toContain("BLOB_");
  });
});

describe("ui surface", () => {
  test("prints no shadcn init — the overlay is the scaffold", () => {
    const out = execFileSync("bun", [script, "--add", "web"], { encoding: "utf8" });
    expect(out).toContain("commands (empty paths):");
    expect(out).toContain("create-next-app");
    // `shadcn init` is a create-a-project flow: it prompts for a framework
    // template, which hangs an unattended run, and would overwrite the overlay.
    expect(out).not.toMatch(/shadcn@latest init|shadcn init --cwd/);
  });

  test("says how to add components instead", () => {
    const out = execFileSync("bun", [script, "--add", "web"], { encoding: "utf8" });
    expect(out).toContain("components (any time after --apply):");
    expect(out).toContain("bun run ui:add --");
  });
});

describe("withAppScripts", () => {
  test("adds check-types, which create-next-app does not write", async () => {
    const { withAppScripts } = await import("./compose.mjs");
    const { pkg, added } = withAppScripts({
      name: "web",
      scripts: { dev: "next dev", build: "next build", lint: "biome check" },
    });
    expect(added).toContain("check-types");
    expect(pkg.scripts["check-types"]).toBe("tsc --noEmit");
    expect(pkg.scripts.dev).toBe("next dev");
    expect(pkg.name).toBe("web");
  });

  test("leaves an existing check-types alone", async () => {
    const { withAppScripts } = await import("./compose.mjs");
    const { added } = withAppScripts({ scripts: { "check-types": "tsc -b" } });
    expect(added).toEqual([]);
  });
});

describe("surface deps", () => {
  test("installs what the env module compose writes actually imports", () => {
    // --apply always writes apps/web/src/env.ts importing these two. Without
    // them the composed app does not typecheck.
    const out = execFileSync("bun", [script, "--add", "web"], { encoding: "utf8" });
    expect(out).toContain("bun add --cwd apps/web @t3-oss/env-nextjs zod");
  });

  test("env deps survive --without auth and --without jobs", () => {
    const out = execFileSync(
      "bun",
      [script, "--add", "web", "--without", "auth", "--without", "jobs"],
      {
        encoding: "utf8",
      },
    );
    expect(out).toContain("@t3-oss/env-nextjs zod");
    expect(out).not.toContain("@clerk/nextjs");
    expect(out).not.toMatch(/bun add --cwd apps\/web workflow/);
  });
});

describe("generateWebEnv", () => {
  test("DATABASE_URL is optional so the first slice runs before Neon exists", async () => {
    const { generateWebEnv } = await import("./compose.mjs");
    const out = generateWebEnv({ auth: true, db: true });
    expect(out).toContain("DATABASE_URL: z.url().optional()");
    // Required would make a keyless dev run impossible; packages/db refuses the
    // PGlite fallback under NODE_ENV=production, so a deploy still fails loudly.
    expect(out).not.toMatch(/DATABASE_URL: z\.url\(\),/);
  });

  test("no db surface means no DATABASE_URL at all", async () => {
    const { generateWebEnv } = await import("./compose.mjs");
    const out = generateWebEnv({ auth: true, db: false });
    expect(out).not.toContain("DATABASE_URL");
  });
});

describe("db surface", () => {
  test("installs the PGlite fallback alongside the Neon driver", () => {
    const out = execFileSync("bun", [script, "--add", "db"], { encoding: "utf8" });
    expect(out).toContain(
      "bun add --cwd packages/db drizzle-orm pg server-only @electric-sql/pglite",
    );
  });
});

describe("app wiring", () => {
  test("depends on the workspace packages compose just created", async () => {
    const { withAppScripts } = await import("./compose.mjs");
    const { pkg } = withAppScripts({ name: "web" }, { scope: "@acme", surfaces: ["web", "ui", "db"] });
    expect(pkg.dependencies["@acme/ui"]).toBe("workspace:*");
    expect(pkg.dependencies["@acme/db"]).toBe("workspace:*");
    expect(pkg.dependencies["server-only"]).toBe("^0.0.1");
    // Queries in the app need the operators, not just the tables.
    expect(pkg.dependencies["drizzle-orm"]).toBeTruthy();
  });

  test("no db surface means no db dependency", async () => {
    const { withAppScripts } = await import("./compose.mjs");
    const { pkg } = withAppScripts({ name: "web" }, { scope: "@acme", surfaces: ["web", "ui"] });
    expect(pkg.dependencies["@acme/db"]).toBeUndefined();
    expect(pkg.dependencies["server-only"]).toBeUndefined();
  });

  test("never clobbers a version the CLI already chose", async () => {
    const { withAppScripts } = await import("./compose.mjs");
    const { pkg } = withAppScripts(
      { name: "web", dependencies: { "server-only": "0.0.1-custom" } },
      { scope: "@acme", surfaces: ["db"] },
    );
    expect(pkg.dependencies["server-only"]).toBe("0.0.1-custom");
  });
});

describe("withServerExternals", () => {
  const config = [
    'import type { NextConfig } from "next";',
    "",
    "const nextConfig: NextConfig = {",
    "  reactCompiler: true,",
    "};",
    "",
    "export default nextConfig;",
  ].join("\n");

  test("marks PGlite external so its wasm is not bundled", async () => {
    const { withServerExternals } = await import("./compose.mjs");
    const out = withServerExternals(config);
    expect(out).toContain('serverExternalPackages: ["@electric-sql/pglite"]');
    // Whatever create-next-app chose stays.
    expect(out).toContain("reactCompiler: true");
  });

  test("is idempotent", async () => {
    const { withServerExternals } = await import("./compose.mjs");
    const once = withServerExternals(config);
    expect(withServerExternals(once)).toBe(once);
  });

  test("leaves an unrecognised config alone rather than corrupting it", async () => {
    const { withServerExternals } = await import("./compose.mjs");
    const odd = "export default { reactCompiler: true };";
    expect(withServerExternals(odd)).toBe(odd);
  });
});

describe("copyOverlay", () => {
  function tree(files: Record<string, string>) {
    const base = mkdtempSync(join(tmpdir(), "overlay-"));
    for (const [rel, body] of Object.entries(files)) {
      const p = join(base, rel);
      mkdirSync(join(p, ".."), { recursive: true });
      writeFileSync(p, body);
    }
    return base;
  }

  test("writes files that are missing", async () => {
    const { copyOverlay } = await import("./compose.mjs");
    const src = tree({ "src/schema.ts": "export {};\n" });
    const dest = mkdtempSync(join(tmpdir(), "dest-"));
    const r = copyOverlay(src, dest);
    expect(r.written).toBe(1);
    expect(r.kept).toEqual([]);
    expect(readFileSync(join(dest, "src/schema.ts"), "utf8")).toBe("export {};\n");
    rmSync(src, { recursive: true, force: true });
    rmSync(dest, { recursive: true, force: true });
  });

  test("keeps a file the product has edited — this used to eat wave 0", async () => {
    const { copyOverlay } = await import("./compose.mjs");
    const src = tree({ "src/schema.ts": "export {};\n" });
    const dest = tree({ "src/schema.ts": "export const students = pgTable(...);\n" });
    const r = copyOverlay(src, dest);
    expect(r.kept).toEqual(["src/schema.ts"]);
    expect(r.written).toBe(0);
    // The schema and the seed survive a second --apply.
    expect(readFileSync(join(dest, "src/schema.ts"), "utf8")).toContain("pgTable");
    rmSync(src, { recursive: true, force: true });
    rmSync(dest, { recursive: true, force: true });
  });

  test("rewrites an untouched file, so --apply stays idempotent", async () => {
    const { copyOverlay } = await import("./compose.mjs");
    const src = tree({ "a.ts": "same\n" });
    const dest = tree({ "a.ts": "same\n" });
    expect(copyOverlay(src, dest).kept).toEqual([]);
    rmSync(src, { recursive: true, force: true });
    rmSync(dest, { recursive: true, force: true });
  });

  test("--force overwrites an edited file", async () => {
    const { copyOverlay } = await import("./compose.mjs");
    const src = tree({ "a.ts": "fresh\n" });
    const dest = tree({ "a.ts": "edited\n" });
    const r = copyOverlay(src, dest, true);
    expect(r.kept).toEqual([]);
    expect(readFileSync(join(dest, "a.ts"), "utf8")).toBe("fresh\n");
    rmSync(src, { recursive: true, force: true });
    rmSync(dest, { recursive: true, force: true });
  });

  test("recurses into nested directories", async () => {
    const { copyOverlay } = await import("./compose.mjs");
    const src = tree({ "src/styles/globals.css": "a\n", "src/lib/utils.ts": "b\n" });
    const dest = mkdtempSync(join(tmpdir(), "dest-"));
    expect(copyOverlay(src, dest).written).toBe(2);
    rmSync(src, { recursive: true, force: true });
    rmSync(dest, { recursive: true, force: true });
  });
});
