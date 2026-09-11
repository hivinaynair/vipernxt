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
 * first, then `--apply`. `--without auth` rewrites apps/web/src/env.ts so
 * Clerk keys are not required. It sets clone.composed: done when state.yaml
 * exists.
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
  "server-only-db": "@repo/db is server-only; schema empty until wave 0",
  "judgment-gate": "Eve proposes; a human posts. Do not put Eve and Workflows on the same step",
};

const SURFACE_OVERLAYS = {
  web: ["bun-only", "feature-folders", "env-module", "check-boundaries", "ui-gate"],
  ui: ["bun-only", "ui-in-packages"],
  db: ["bun-only", "server-only-db"],
  agent: ["bun-only", "judgment-gate"],
};

function generateWebEnv({ auth, db }) {
  const server = [];
  if (db) {
    server.push("    DATABASE_URL: z.url(),");
    server.push("    DATABASE_URL_UNPOOLED: z.url().optional(),");
  }
  if (auth) {
    server.push("    CLERK_SECRET_KEY: z.string().min(1),");
  }
  server.push("    /** Preview-only screenshot login. Never set in production. */");
  server.push("    PREVIEW_LOGIN_SECRET: z.string().min(16).optional(),");
  const client = auth ? `{\n    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),\n  }` : "{}";
  const runtime = auth
    ? `{\n    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,\n  }`
    : "{}";
  return `import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
${server.join("\n")}
  },
  client: ${client},
  experimental__runtimeEnv: ${runtime},
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

lines.push("", "order: empty-path CLIs, then --apply, then `commands (after --apply)`.");
lines.push("      create-next-app / eve init / shadcn init refuse a non-empty folder.");

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

if (selected.includes("web")) {
  const envPath = join(cwd, catalog.web?.path ?? "apps/web", "src/env.ts");
  mkdirSync(dirname(envPath), { recursive: true });
  writeFileSync(
    envPath,
    generateWebEnv({
      auth: !without.has("auth") && selected.includes("web"),
      db: selected.includes("db"),
    }),
  );
  process.stdout.write(
    `env ${envPath.replace(`${cwd}/`, "")} · auth=${without.has("auth") ? "off" : "on"} db=${selected.includes("db") ? "on" : "off"}\n`,
  );
}

setCloneFlag(cwd, "composed", "done");

process.stdout.write(text);
process.stdout.write(`wrote ${outPath}\n`);
