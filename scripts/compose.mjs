#!/usr/bin/env bun
/**
 * Reads docs/kit/recipe.yaml and prints the scaffold plan.
 *
 *   bun scripts/compose.mjs
 *   bun scripts/compose.mjs --add web --add db
 *   bun scripts/compose.mjs --add web --without jobs
 *   bun scripts/compose.mjs --add web --apply
 *
 * `--apply` writes docs/kit/composed.yaml on a named site clone and copies
 * overlay files from docs/kit/overlays/. It refuses while the root package is
 * still vipernxt. It does not run the CLIs yet — run those into empty paths
 * first, then `--apply`. `--without auth` / `analytics` / `email` / `files`
 * rewrites apps/web/src/env.ts so those keys are not required. It sets
 * clone.composed: done when state.yaml exists.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const OVERLAYS = {
  "bun-only": "only-allow bun; no npm/pnpm/yarn, Vitest, or ESLint",
  "feature-folders": "apps/web/src/{app,features,shared}; features do not import each other",
  "ui-in-packages": "shadcn lives in packages/ui; apps import @repo/ui",
  "env-module": "import env from @/env; never process.env in app code",
  "check-boundaries": "tooling/dependency-cruiser + bun run check-boundaries",
  "ui-gate": "deny apps/*/src/app and src/features until shape is done",
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
export function withAppScripts(pkg) {
  const added = [];
  const scripts = { ...(pkg.scripts ?? {}) };
  if (!scripts["check-types"]) {
    scripts["check-types"] = "tsc --noEmit";
    added.push("check-types");
  }
  return { pkg: { ...pkg, scripts }, added };
}

function ensureAppScripts(appDir) {
  const pkgPath = join(appDir, "package.json");
  if (!existsSync(pkgPath)) {
    process.stderr.write(`warn: ${pkgPath} not found — run the empty-path CLI before --apply.\n`);
    return;
  }
  const before = JSON.parse(readFileSync(pkgPath, "utf8"));
  const { pkg, added } = withAppScripts(before);
  if (!added.length) return;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  process.stdout.write(`scripts ${pkgPath.replace(`${cwd}/`, "")} + ${added.join(", ")}\n`);
}

function generateWebEnv({ auth, db, analytics, email, files }) {
  const server = [];
  const client = [];
  const runtime = [];
  if (db) {
    server.push("    DATABASE_URL: z.url(),");
    server.push("    DATABASE_URL_UNPOOLED: z.url().optional(),");
  }
  if (auth) {
    server.push("    CLERK_SECRET_KEY: z.string().min(1),");
    client.push("    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),");
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

function setCloneFlag(root, key, value) {
  const p = join(root, "docs/product/state.yaml");
  if (!existsSync(p)) return;
  const before = readFileSync(p, "utf8");
  const after = before.replace(new RegExp(`^(  ${key}: )pending\\s*$`, "m"), `$1${value}`);
  if (after !== before) writeFileSync(p, after);
}

const args = process.argv.slice(2);
const has = (name) => args.includes(`--${name}`);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};

function collect(name) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== `--${name}`) continue;
    const v = args[i + 1];
    if (!v || v.startsWith("--")) {
      console.error(`--${name} needs a value`);
      process.exit(1);
    }
    out.push(
      ...v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }
  return out;
}

const unknown = args.filter(
  (a) => a.startsWith("--") && !["--add", "--without", "--apply", "--recipe", "--cwd"].includes(a),
);
if (unknown.length) {
  console.error(`unknown flag ${unknown[0]}`);
  process.exit(1);
}

const cwd = flag("cwd") ?? process.cwd();
const recipePath = flag("recipe") ?? join(cwd, "docs/kit/recipe.yaml");
const apply = has("apply");
const requested = collect("add");
const without = new Set(collect("without"));

if (!existsSync(recipePath)) {
  console.error(`no recipe at ${recipePath}`);
  process.exit(1);
}

let recipe;
try {
  recipe = Bun.YAML.parse(readFileSync(recipePath, "utf8"));
} catch (e) {
  console.error(`could not parse ${recipePath}: ${e.message}`);
  process.exit(1);
}

const catalog = recipe.surfaces ?? {};
const known = Object.keys(catalog);
if (known.length === 0) {
  console.error("recipe has no surfaces");
  process.exit(1);
}

for (const s of requested) {
  if (!known.includes(s)) {
    console.error(`unknown surface ${s} — recipe knows: ${known.join(", ")}`);
    process.exit(1);
  }
}

const selected = [];
const seen = new Set();
function addSurface(name) {
  if (seen.has(name)) return;
  seen.add(name);
  selected.push(name);
  for (const dep of catalog[name]?.implies ?? []) addSurface(dep);
}
for (const s of requested.length ? requested : known) addSurface(s);

const commandsBefore = [];
const commandsAfter = [];
function cmd(bin, argv = [], when = "before") {
  const line = [bin, ...argv].join(" ");
  (when === "after" ? commandsAfter : commandsBefore).push(line);
}

for (const name of selected) {
  const s = catalog[name];
  if (!s?.command) continue;
  const after = s.command === "bun add" || String(s.command).startsWith("bun add");
  const argv = [...(s.args ?? [])];
  if (after && s.path) cmd(s.command, ["--cwd", s.path, ...argv], "after");
  else cmd(s.command, argv, after ? "after" : "before");
}

const facets = recipe.facets ?? {};
for (const [name, facet] of Object.entries(facets)) {
  if (without.has(name)) continue;
  if (!selected.includes(facet.on)) continue;
  if (!facet.command) continue;
  const dest = catalog[facet.on]?.path;
  const argv = dest ? ["--cwd", dest, ...(facet.args ?? [])] : [...(facet.args ?? [])];
  cmd(facet.command, argv, "after");
}

const commands = [...commandsBefore, ...commandsAfter];

const overlayIds = [];
const overlaySeen = new Set();
for (const name of selected) {
  for (const id of SURFACE_OVERLAYS[name] ?? []) {
    if (overlaySeen.has(id)) continue;
    overlaySeen.add(id);
    overlayIds.push(id);
  }
}
for (const name of Object.keys(facets)) {
  if (without.has(name) || !selected.includes(facets[name]?.on)) continue;
  if (!OVERLAYS[name] || overlaySeen.has(name)) continue;
  overlaySeen.add(name);
  overlayIds.push(name);
}

const mode = requested.length ? "plan" : "catalog";
const lines = [`compose ${mode}`, `surfaces: ${selected.join(", ")}`];
if (commandsBefore.length) {
  lines.push("", "commands (empty paths):");
  for (const c of commandsBefore) lines.push(`  ${c}`);
}
if (commandsAfter.length) {
  lines.push("", "commands (after --apply):");
  for (const c of commandsAfter) lines.push(`  ${c}`);
}
if (!commandsBefore.length && !commandsAfter.length) {
  lines.push("", "commands:", "  (none)");
}
lines.push("", "overlays:");
for (const id of overlayIds) lines.push(`  ${id}: ${OVERLAYS[id]}`);

const setup = recipe.setup ?? {};
if (setup.neon && selected.includes("db")) {
  const region = setup.neon.default ?? "aws-us-east-1";
  const flagName = setup.neon.regionFlag ?? "--region";
  lines.push("", "setup (after they accept the clip):");
  lines.push(`  ${setup.neon.cli} --name $PRODUCT ${flagName} $NEON_REGION --database staging`);
  lines.push(`  NEON_REGION default: ${region}`);
  if (setup.neon.regions) lines.push(`  regions: ${setup.neon.regions.join(", ")}`);
  if (setup.env) lines.push(`  env: ${setup.env}`);
} else if (setup.neon && !selected.includes("db")) {
  lines.push("", "setup: skip Neon — db is not a selected surface");
}
if (without.has("auth")) lines.push("setup: skip Clerk — --without auth");
if (without.has("analytics")) lines.push("setup: skip PostHog — --without analytics");
if (without.has("email")) lines.push("setup: skip Resend — --without email");
if (without.has("files")) lines.push("setup: skip Blob — --without files");

const uiAdd = catalog.ui?.add;
if (uiAdd && selected.includes("ui")) {
  lines.push("", "components (any time after --apply):");
  lines.push(`  ${uiAdd} <component>`);
  lines.push("  packages/ui is supplied by the overlay. Do not run `shadcn init` there —");
  lines.push("  it prompts for a framework template and scaffolds a second project.");
}

lines.push("", "order: empty-path CLIs, then --apply, then `commands (after --apply)`.");
lines.push("      create-next-app / eve init refuse a non-empty folder.");

const text = `${lines.join("\n")}\n`;

if (!apply) {
  process.stdout.write(text);
  process.exit(0);
}

const pkgPath = join(cwd, "package.json");
const pkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, "utf8")) : {};
if ((pkg.name ?? "vipernxt") === "vipernxt") {
  console.error(
    "compose --apply refuses on the kit (package name vipernxt). Run it on the site clone after U5.",
  );
  process.exit(1);
}

const outPath = join(cwd, "docs/kit/composed.yaml");
mkdirSync(dirname(outPath), { recursive: true });
const composed = {
  surfaces: selected,
  without: [...without],
  commands,
  overlays: overlayIds,
  majors: recipe.majors ?? {},
};
writeFileSync(outPath, `${Bun.YAML.stringify(composed)}\n`);

const overlayRoot = join(dirname(recipePath), "overlays");
for (const name of selected) {
  const src = join(overlayRoot, name);
  const destRel = catalog[name]?.path;
  if (!destRel) continue;
  if (!existsSync(src)) {
    process.stderr.write(`warn: no overlay directory for ${name} at ${src}\n`);
    continue;
  }
  const dest = join(cwd, destRel);
  if (
    name !== "db" &&
    existsSync(dest) &&
    !existsSync(join(dest, "package.json")) &&
    existsSync(join(dest, "src"))
  ) {
    process.stderr.write(
      `warn: ${destRel} has overlay files but no package.json — the CLI will refuse this directory. Scaffold into an empty path, then --apply.\n`,
    );
  }
  cpSync(src, dest, { recursive: true });
  process.stdout.write(`overlay ${name} → ${destRel}\n`);
}

for (const name of Object.keys(facets)) {
  if (without.has(name) || !selected.includes(facets[name]?.on)) continue;
  const src = join(overlayRoot, name);
  const destRel = catalog[facets[name].on]?.path;
  if (!destRel || !existsSync(src)) continue;
  cpSync(src, join(cwd, destRel), { recursive: true });
  process.stdout.write(`overlay ${name} → ${destRel}\n`);
}

if (selected.includes("web")) {
  const web = selected.includes("web");
  const envOpts = {
    auth: web && !without.has("auth"),
    db: selected.includes("db"),
    analytics: web && !without.has("analytics"),
    email: web && !without.has("email"),
    files: web && !without.has("files"),
  };
  const envPath = join(cwd, catalog.web?.path ?? "apps/web", "src/env.ts");
  mkdirSync(dirname(envPath), { recursive: true });
  writeFileSync(envPath, generateWebEnv(envOpts));
  process.stdout.write(
    `env ${envPath.replace(`${cwd}/`, "")} · auth=${envOpts.auth ? "on" : "off"} db=${envOpts.db ? "on" : "off"} analytics=${envOpts.analytics ? "on" : "off"} email=${envOpts.email ? "on" : "off"} files=${envOpts.files ? "on" : "off"}\n`,
  );
}

if (selected.includes("web")) {
  ensureAppScripts(join(cwd, catalog.web?.path ?? "apps/web"));
}

setCloneFlag(cwd, "composed", "done");

process.stdout.write(text);
process.stdout.write(`wrote ${outPath}\n`);
