#!/usr/bin/env bun

/**
 * Plan: bun run scaffold -- --add web --add db
 * Execute CLIs, overlays, install and checks: add --run.
 * Manual: printed CLIs, --apply, printed dependencies, --verify.
 * Only verification marks clone.scaffolded done. Imports have no CLI effects.
 */

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

const OVERLAYS = {
  "bun-only": "only-allow bun; no npm/pnpm/yarn, Vitest, or ESLint",
  "feature-folders": "apps/web/src/{app,features,shared}; features do not import each other",
  "ui-in-packages": "shadcn lives in packages/ui; apps import @repo/ui",
  "env-module": "import env from @/env; never process.env in app code",
  "check-boundaries": "tooling/dependency-cruiser + bun run check-boundaries",
  "ui-gate": "deny apps/*/src/app and src/features until shape is done",
  auth: "Clerk browser test helpers; dedicated development identities only",
  analytics: "PostHog errors + product analytics; keys optional until setup",
  email: "Resend; RESEND_API_KEY optional until setup",
  files: "Vercel Blob; BLOB_READ_WRITE_TOKEN optional until setup",
  "server-only-db": "@repo/db is server-only; schema empty until wave 0",
  "judgment-gate": "Eve proposes; a human posts. Do not put Eve and Workflows on the same step",
};

const SURFACE_OVERLAYS = {
  web: ["bun-only", "feature-folders", "env-module", "check-boundaries", "ui-gate"],
  ui: ["bun-only", "ui-in-packages"],
  db: ["bun-only", "server-only-db"],
  agent: ["bun-only", "judgment-gate"],
};

function objectBlock(lines) {
  if (!lines.length) return "{}";
  return `{\n${lines.join("\n")}\n  }`;
}

/**
 * create-next-app writes dev/build/start/lint but no `check-types`, so
 * `turbo run check-types` reports green having never typechecked the app the
 * product is written in. Add the script (and the deps turbo needs to order it)
 * without disturbing anything the CLI wrote.
 *
 * Exported for the test; returns the keys it added.
 */
export function withAppScripts(
  pkg,
  { scope = "@repo", surfaces = [], dbMajor = "^1.0.0-beta.22" } = {},
) {
  const added = [];
  const scripts = { ...(pkg.scripts ?? {}) };
  if (!scripts["check-types"]) {
    scripts["check-types"] = "tsc --noEmit";
    added.push("check-types");
  }

  if (surfaces.includes("auth") && !scripts.e2e) scripts.e2e = "playwright test";

  // create-next-app has no idea the scaffolded workspace packages exist, so
  // nothing in the app could import them.
  const deps = { ...(pkg.dependencies ?? {}) };
  const want = {};
  if (surfaces.includes("ui")) want[`${scope}/ui`] = "workspace:*";
  if (surfaces.includes("db")) {
    want[`${scope}/db`] = "workspace:*";
    want["server-only"] = "^0.0.1";
    // Any query in the app needs the operators (eq, asc, sql) alongside the
    // tables it imports from the db package.
    want["drizzle-orm"] = dbMajor;
  }
  for (const [name, range] of Object.entries(want)) {
    if (!deps[name]) {
      deps[name] = range;
      added.push(name);
    }
  }

  return { pkg: { ...pkg, scripts, dependencies: deps }, added };
}

/**
 * PGlite ships a wasm binary it reads off disk. Bundled by Turbopack, its
 * loader hands Node's fs a URL where a path is wanted and every query fails at
 * runtime -- after the build succeeds, which is the worst place to find it.
 *
 * Exported for the test.
 */
export function withServerExternals(source) {
  if (source.includes("@electric-sql/pglite")) return source;
  const marker = "const nextConfig: NextConfig = {";
  if (!source.includes(marker)) return source;
  return source.replace(
    marker,
    `${marker}\n  /** PGlite reads its wasm off disk; bundling it breaks every query. */\n  serverExternalPackages: ["@electric-sql/pglite"],`,
  );
}

/**
 * Overlays are starting points, not managed files. `packages/db/src/schema.ts`
 * and `seed.ts` in particular are stubs the product fills in at wave 0 — and a
 * plain recursive copy silently reverted them to empty on any later
 * `--apply`, taking the schema and the seed with them.
 *
 * So: write files that are missing or unchanged, and keep anything the product
 * has edited. Exported for the test; returns what it did.
 */
export function copyOverlay(src, dest, force = false, rel = "") {
  let written = 0;
  const kept = [];
  for (const entry of readdirSync(join(src, rel), { withFileTypes: true })) {
    const next = rel ? join(rel, entry.name) : entry.name;
    if (entry.isDirectory()) {
      const sub = copyOverlay(src, dest, force, next);
      written += sub.written;
      kept.push(...sub.kept);
      continue;
    }
    if (next === "src/env.ts") continue;
    const from = join(src, next);
    const to = join(dest, next);
    if (!force && existsSync(to) && readFileSync(to, "utf8") !== readFileSync(from, "utf8")) {
      kept.push(next);
      continue;
    }
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    written += 1;
  }
  return { written, kept };
}

/** The scope the clone was renamed to, read off a scaffolded package. */
function workspaceScope(root) {
  for (const rel of ["packages/db/package.json", "packages/ui/package.json"]) {
    const p = join(root, rel);
    if (!existsSync(p)) continue;
    const name = JSON.parse(readFileSync(p, "utf8")).name ?? "";
    if (name.startsWith("@")) return name.split("/")[0];
  }
  return "@repo";
}

function ensureAppScripts(appDir, opts) {
  const pkgPath = join(appDir, "package.json");
  if (!existsSync(pkgPath)) {
    process.stderr.write(`warn: ${pkgPath} not found — run the empty-path CLI before --apply.\n`);
    return;
  }
  const before = JSON.parse(readFileSync(pkgPath, "utf8"));
  const { pkg: patched, added } = withAppScripts(before, opts);
  if (added.length) {
    writeFileSync(pkgPath, `${JSON.stringify(patched, null, 2)}\n`);
    process.stdout.write(`package ${pkgPath.replace(`${opts.root}/`, "")} + ${added.join(", ")}\n`);
  }

  if (opts?.surfaces?.includes("db")) {
    const cfgPath = join(appDir, "next.config.ts");
    if (existsSync(cfgPath)) {
      const src = readFileSync(cfgPath, "utf8");
      const out = withServerExternals(src);
      if (out !== src) {
        writeFileSync(cfgPath, out);
        process.stdout.write(
          `config ${cfgPath.replace(`${opts.root}/`, "")} + serverExternalPackages\n`,
        );
      }
    }
  }
}

export function generateWebEnv({ auth, db, analytics, email, files }) {
  const server = [];
  const client = [];
  const runtime = [];
  if (db) {
    // Optional so the first slice runs before anyone has provisioned Neon.
    // packages/db falls back to PGlite when it is unset, and refuses to do so
    // when NODE_ENV=production — so a deploy missing this still fails loudly.
    server.push("    /** Unset in development: packages/db falls back to local PGlite. */");
    server.push("    DATABASE_URL: z.url().optional(),");
    server.push("    DATABASE_URL_UNPOOLED: z.url().optional(),");
  }
  if (auth) {
    // Optional for the same reason DATABASE_URL is: Clerk runs keyless in
    // `next dev`, and /next defers keys until they accept the clip. Required
    // here, the first page that obeys the env-module rule ("import env from
    // @/env, never process.env") 500s on a product with no auth in it yet.
    // Both keys, not just the secret — keyless means neither is set.
    server.push("    /** Unset in development: `next dev` runs Clerk keyless. */");
    server.push("    CLERK_SECRET_KEY: z.string().min(1).optional(),");
    client.push("    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),");
    runtime.push(
      "    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,",
    );
  }
  if (email) {
    server.push("    RESEND_API_KEY: z.string().min(1).optional(),");
  }
  if (files) {
    server.push("    BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),");
  }
  if (analytics) {
    client.push("    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: z.string().min(1).optional(),");
    client.push("    NEXT_PUBLIC_POSTHOG_HOST: z.url().optional(),");
    runtime.push(
      "    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN,",
    );
    runtime.push("    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,");
  }
  server.push("    /** Preview-only screenshot login. Never set in production. */");
  server.push("    PREVIEW_LOGIN_SECRET: z.string().min(16).optional(),");
  return `import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
${server.join("\n")}
  },
  client: ${objectBlock(client)},
  experimental__runtimeEnv: ${objectBlock(runtime)},
  skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
  emptyStringAsUndefined: true,
});
`;
}

function readYaml(path, fallback = {}) {
  return existsSync(path) ? Bun.YAML.parse(readFileSync(path, "utf8")) : fallback;
}
function saveYaml(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(`${path}.tmp`, `${Bun.YAML.stringify(value, null, 2)}\n`);
  renameSync(`${path}.tmp`, path);
}
function setCloneFlag(root, value) {
  const path = join(root, "docs/product/state.yaml");
  if (!existsSync(path)) return;
  const state = readYaml(path);
  state.clone = { ...state.clone, scaffolded: value };
  saveYaml(path, state);
}
function execute(argv, cwd) {
  console.log(`$ ${argv.join(" ")}`);
  const child = spawnSync(argv[0], argv.slice(1), { cwd, stdio: "inherit" });
  if (child.error || child.status !== 0)
    throw new Error(`Command failed: ${argv[0]} (exit ${child.status ?? "unknown"})`);
}
const envOptions = (surfaces, without) =>
  Object.fromEntries(
    ["auth", "analytics", "email", "files"]
      .map((name) => [name, surfaces.includes("web") && !without.includes(name)])
      .concat([["db", surfaces.includes("db")]]),
  );
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Plan is read-only. Apply writes configuration; only successful verification marks done. */
export function main(args = process.argv.slice(2)) {
  const opts = { add: [], without: [] };
  for (let i = 0; i < args.length; i++) {
    const key = args[i].replace(/^--/, "");
    if (["apply", "run", "verify"].includes(key)) opts[key] = true;
    else if (["add", "without", "cwd", "recipe"].includes(key)) {
      const value = args[++i];
      if (!value || value.startsWith("--")) throw new Error(`--${key} needs a value`);
      if (Array.isArray(opts[key])) opts[key].push(...value.split(",").filter(Boolean));
      else opts[key] = value;
    } else throw new Error(`unknown flag ${args[i]}`);
  }
  const root = resolve(opts.cwd ?? process.cwd());
  const recipePath = resolve(opts.recipe ?? join(root, "docs/kit/recipe.yaml"));
  if (!existsSync(recipePath)) throw new Error(`no recipe at ${recipePath}`);
  const recipe = readYaml(recipePath);
  const catalog = recipe.surfaces ?? {};
  const facets = recipe.facets ?? {};
  const known = Object.keys(catalog);
  if (!known.length) throw new Error("recipe has no surfaces");
  const manifestPath = join(root, "docs/kit/scaffolded.yaml");
  const previous = readYaml(manifestPath, { surfaces: [], without: [] });
  const mutation = opts.apply || opts.run || opts.verify;
  if (mutation && !opts.add.length && !previous.surfaces.length)
    throw new Error("Select surfaces with --add before applying the scaffold.");
  const selected = [];
  const add = (name) => {
    if (!known.includes(name)) throw new Error(`unknown surface ${name}`);
    if (selected.includes(name)) return;
    selected.push(name);
    for (const implied of catalog[name].implies ?? []) add(implied);
  };
  for (const name of [
    ...previous.surfaces,
    ...(opts.add.length ? opts.add : previous.surfaces.length ? [] : known),
  ])
    add(name);
  const without = [...new Set([...previous.without, ...opts.without])];
  for (const name of without) {
    if (!facets[name]) throw new Error(`unknown facet ${name}`);
    if (previous.surfaces.includes(facets[name].on) && !previous.without.includes(name)) {
      throw new Error(
        `Cannot remove installed facet ${name} with --without. Plan its code and data removal explicitly; no files changed.`,
      );
    }
  }
  const paths = {};
  for (const name of selected) {
    const rel = catalog[name].path;
    if (!rel || rel.startsWith("/") || rel.split(/[\\/]/).includes(".."))
      throw new Error(`Invalid surface path for ${name}`);
    paths[name] = join(root, rel);
  }
  const before = [],
    after = [];
  for (const name of selected) {
    const surface = catalog[name];
    if (surface.command && !existsSync(join(paths[name], "package.json")))
      before.push({ argv: [...surface.command.split(" "), ...surface.args], path: paths[name] });
    if (surface.deps?.length) after.push(["bun", "add", "--cwd", surface.path, ...surface.deps]);
  }
  for (const [name, facet] of Object.entries(facets)) {
    if (selected.includes(facet.on) && !without.includes(name) && facet.command)
      after.push([...facet.command.split(" "), "--cwd", catalog[facet.on].path, ...facet.args]);
  }
  if (selected.includes("web") && !without.includes("auth"))
    after.push([
      "bun",
      "add",
      "--dev",
      "--cwd",
      catalog.web.path,
      "@clerk/testing",
      "@playwright/test",
    ]);
  const overlayIds = [...new Set(selected.flatMap((name) => SURFACE_OVERLAYS[name] ?? []))];
  for (const name of Object.keys(facets))
    if (selected.includes(facets[name].on) && !without.includes(name) && OVERLAYS[name])
      overlayIds.push(name);
  console.log(
    `scaffold ${opts.add.length || previous.surfaces.length ? "plan" : "catalog"}\nsurfaces: ${selected.join(", ")}`,
  );
  console.log("\ncommands (empty paths):");
  for (const { argv } of before) console.log(`  ${argv.join(" ")}`);
  console.log("\ncommands (after --apply):");
  for (const argv of after) console.log(`  ${argv.join(" ")}`);
  console.log("  bun install\n  bun scripts/scaffold.mjs --verify");
  console.log(`\noverlays:\n${overlayIds.map((id) => `  ${id}: ${OVERLAYS[id]}`).join("\n")}`);
  if (selected.includes("db"))
    console.log(
      `\nDB migration workflow: .github/workflows/migrate.yml\nNeon regions: ${(recipe.setup?.neon?.regions ?? []).join(", ")}`,
    );
  else console.log("setup: skip Neon — db is not selected");
  for (const name of without)
    console.log(
      `setup: skip ${{ auth: "Clerk", analytics: "PostHog", email: "Resend", files: "Blob" }[name] ?? name}`,
    );
  if (selected.includes("ui"))
    console.log(
      `\ncomponents (any time after --apply):\n  ${catalog.ui.add} <component>\n  The UI overlay is the scaffold; do not run shadcn init.`,
    );
  if (!mutation) return;
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  if (pkg.name === "vipernxt")
    throw new Error("scaffold refuses on the kit; name the product clone first.");
  const state = readYaml(join(root, "docs/product/state.yaml"));
  if (
    state.ui_writes === "deny" ||
    (state.phases &&
      state.ui_writes !== "allow" &&
      !Object.values(state.phases).some((p) => p.name === "shape" && p.status === "done"))
  )
    throw new Error("Shape must be approved before scaffolding product files.");
  const overlayRoot = join(dirname(recipePath), "overlays");
  for (const name of selected)
    if (!existsSync(join(overlayRoot, name))) throw new Error(`Missing overlay ${name}`);
  const envPath = paths.web && join(paths.web, "src/env.ts");
  const generatedPath = paths.web && join(paths.web, "src/env.generated.ts");
  const wrapper = 'export { env } from "./env.generated";\n';
  const oldEnv = envOptions(previous.surfaces, previous.without);
  const newEnv = envOptions(selected, without);
  const legacyEnv = paths.web && existsSync(envPath) ? readFileSync(envPath, "utf8") : undefined;
  if (
    legacyEnv &&
    legacyEnv !== wrapper &&
    legacyEnv !== generateWebEnv(oldEnv) &&
    (!previous.surfaces.includes("web") || !same(oldEnv, newEnv))
  )
    throw new Error(
      "Custom env.ts requires explicit integration of the new vendor keys; no files changed.",
    );
  if (
    generatedPath &&
    existsSync(generatedPath) &&
    readFileSync(generatedPath, "utf8") !== generateWebEnv(oldEnv)
  )
    throw new Error(
      "env.generated.ts was edited; move custom definitions into env.ts before scaffolding.",
    );
  const workflowPath = join(root, ".github/workflows/migrate.yml");
  const workflowSource = join(dirname(recipePath), "workflows/migrate.yml");
  if (selected.includes("db")) {
    if (!existsSync(workflowSource)) throw new Error("Missing DB workflow template");
    if (
      existsSync(workflowPath) &&
      readFileSync(workflowPath, "utf8") !== readFileSync(workflowSource, "utf8")
    )
      throw new Error(
        "Existing migration workflow differs; reconcile it explicitly before scaffolding.",
      );
  }
  if (
    opts.verify &&
    !opts.run &&
    !opts.apply &&
    (!same(selected, previous.surfaces) || !same(without, previous.without))
  )
    throw new Error("Apply new selections before --verify.");
  if (opts.run) {
    setCloneFlag(root, "pending");
    for (const task of before) {
      mkdirSync(dirname(task.path), { recursive: true });
      execute(task.argv, root);
      if (task.path === paths.web) {
        // Only replace the stock page generated by this invocation. Existing apps
        // remain product-owned, including on a resumed or additive run.
        const starter = join(dirname(recipePath), "starter/web");
        for (const file of ["page.tsx", "layout.tsx", "globals.css"]) {
          copyFileSync(join(starter, file), join(paths.web, "src/app", file));
        }
      }
    }
  }
  for (const name of selected) {
    if (catalog[name].command && !existsSync(join(paths[name], "package.json")))
      throw new Error(
        `Missing ${catalog[name].path}/package.json. Run the printed CLI first, or use --run. No completion recorded.`,
      );
  }
  if (selected.includes("web")) {
    const app = JSON.parse(readFileSync(join(paths.web, "package.json"), "utf8"));
    for (const dep of ["next", "react"]) {
      const version = app.dependencies?.[dep];
      if (!version || !new RegExp(`^[~^]?${recipe.majors[dep]}\\.`).test(version))
        throw new Error(`${dep} must use recipe major ${recipe.majors[dep]}, got ${version}`);
    }
    if (app.devDependencies?.eslint || app.dependencies?.eslint)
      throw new Error(
        "Scaffold CLI selected ESLint; use the recipe's explicit --no-linter option.",
      );
  }
  const manifest = {
    ...previous,
    surfaces: selected,
    without,
    paths: Object.fromEntries(selected.map((name) => [name, catalog[name].path])),
    overlays: overlayIds,
    majors: recipe.majors,
    status: "configured",
  };
  if (opts.apply || opts.run) {
    setCloneFlag(root, "pending");
    saveYaml(manifestPath, manifest);
    for (const name of [
      ...selected,
      ...Object.keys(facets).filter(
        (name) => selected.includes(facets[name].on) && !without.includes(name),
      ),
    ]) {
      const src = join(overlayRoot, name);
      if (!existsSync(src)) continue;
      const dest = paths[name] ?? paths[facets[name].on];
      const result = copyOverlay(src, dest);
      console.log(`overlay ${name} → ${catalog[name]?.path ?? catalog[facets[name].on].path}`);
      for (const rel of result.kept)
        console.log(
          `  kept ${join(catalog[name]?.path ?? catalog[facets[name].on].path, rel)} — product-owned`,
        );
    }
    if (paths.web) {
      mkdirSync(dirname(envPath), { recursive: true });
      writeFileSync(generatedPath, generateWebEnv(newEnv));
      if (!legacyEnv || legacyEnv === generateWebEnv(oldEnv)) writeFileSync(envPath, wrapper);
      ensureAppScripts(paths.web, {
        root,
        scope: workspaceScope(root),
        surfaces: [...selected, ...(without.includes("auth") ? [] : ["auth"])],
      });
    }
    if (selected.includes("db")) {
      mkdirSync(dirname(workflowPath), { recursive: true });
      copyFileSync(workflowSource, workflowPath);
    }
  }
  if (opts.run) {
    for (const argv of after) execute(argv, root);
    execute(["bun", "install"], root);
  }
  if (opts.run || opts.verify) {
    setCloneFlag(root, "pending");
    saveYaml(manifestPath, { ...manifest, status: "verifying" });
    try {
      for (const name of selected) {
        if (!existsSync(join(paths[name], "package.json")))
          throw new Error(`Missing package for ${name}`);
      }
      for (const check of ["check-types", "check-boundaries", "check-tokens"])
        execute(["bun", "run", check], root);
      const versions = {};
      if (paths.web) {
        for (const dep of ["next", "react"])
          versions[dep] = JSON.parse(
            readFileSync(join(paths.web, "node_modules", dep, "package.json"), "utf8"),
          ).version;
      }
      for (const [dep, version] of Object.entries(versions)) {
        if (Number(version.split(".")[0]) !== recipe.majors[dep])
          throw new Error(
            `Installed ${dep} ${version} violates recipe major ${recipe.majors[dep]}`,
          );
      }
      saveYaml(manifestPath, { ...manifest, status: "verified", versions });
      setCloneFlag(root, "done");
      console.log("Scaffold verified. Runtime behavior and deployment are separate checks.");
    } catch (error) {
      saveYaml(manifestPath, { ...manifest, status: "failed" });
      throw error;
    }
  } else
    console.log(
      "Scaffold configured. Install the printed dependencies, then run --verify; completion remains pending.",
    );
}
if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
