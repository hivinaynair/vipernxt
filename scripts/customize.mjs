#!/usr/bin/env node
// Applies the mechanical half of `customize`: renaming the clone.
//
//   node scripts/customize.mjs --name acme [--scope @acme] [--app dashboard]
//   node scripts/customize.mjs --name acme --apply
//
// Dry run unless --apply is passed; it prints every file it would touch.
//
// Renaming is where this goes wrong by hand — a package name lives in the root
// package.json, every workspace package.json, every dependency entry, tsconfig
// `extends`, turbo filters, the Playwright webDir, and the docs. Miss one and
// the failure shows up much later as a confusing resolution error. So the
// interview stays with the agent and the find-and-replace does not.
//
// Vendor stripping (Clerk, Workflows, the database) is deliberately NOT here:
// it deletes source files and edits app code, which needs judgement about what
// else referenced them. The skill owns that.

import {
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);

const name = flag("name");
const scope = flag("scope");
const app = flag("app");
const apply = has("apply");

if (!name) {
  console.error("usage: customize.mjs --name <kebab> [--scope @acme] [--app <dir>] [--apply]");
  process.exit(1);
}
if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
  console.error(`--name must be npm-safe kebab-case, got "${name}"`);
  process.exit(1);
}
if (scope && !/^@[a-z0-9][a-z0-9-]*$/.test(scope)) {
  console.error(`--scope must look like @acme, got "${scope}"`);
  process.exit(1);
}

const SKIP = new Set(["node_modules", ".git", ".next", ".turbo", "dist", "build", "raw"]);
const TEXT = /\.(json|ts|tsx|mjs|js|jsonc|md|yaml|yml)$/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (TEXT.test(entry)) out.push(p);
  }
  return out;
}

const edits = new Map(); // path -> new content

function edit(path, fn) {
  if (!existsSync(path)) return;
  const before = edits.get(path) ?? readFileSync(path, "utf8");
  const after = fn(before);
  if (after !== before) edits.set(path, after);
}

// 1. Root package name.
edit("package.json", (s) => s.replace(/^(\s*"name":\s*")vipernxt(")/m, `$1${name}$2`));

// 2. Workspace scope, everywhere it can appear.
if (scope && scope !== "@repo") {
  for (const path of walk(".")) {
    edit(path, (s) => s.replaceAll("@repo/", `${scope}/`));
  }
}

// 3. App directory rename, and every reference to it.
const renames = [];
if (app && app !== "web") {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(app)) {
    console.error(`--app must be kebab-case, got "${app}"`);
    process.exit(1);
  }
  if (existsSync("apps/web")) renames.push(["apps/web", `apps/${app}`]);
  if (existsSync("e2e/web")) renames.push(["e2e/web", `e2e/${app}`]);

  for (const path of walk(".")) {
    edit(path, (s) =>
      s
        .replaceAll("apps/web", `apps/${app}`)
        .replaceAll("e2e/web", `e2e/${app}`)
        .replaceAll('"@repo/web-e2e"', `"@repo/${app}-e2e"`)
        .replaceAll('"name": "web"', `"name": "${app}"`)
        .replaceAll("--filter=web", `--filter=${app}`),
    );
  }
}

// 4. PRODUCT into .env.playbook, so setup cannot provision under the old name.
const envPath = ".env.playbook";
const envBefore = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const envAfter = /^PRODUCT=/m.test(envBefore)
  ? envBefore.replace(/^PRODUCT=.*$/m, `PRODUCT=${name}`)
  : `${envBefore.replace(/\n*$/, "")}\nPRODUCT=${name}\n`.replace(/^\n/, "");
if (envAfter !== envBefore) edits.set(envPath, envAfter);

// Report, then write.
if (edits.size === 0 && renames.length === 0) {
  console.log("nothing to change — already customized?");
  process.exit(0);
}

console.log(apply ? "applying:" : "dry run — pass --apply to write:");
for (const [from, to] of renames) console.log(`  move  ${from} -> ${to}`);
for (const path of [...edits.keys()].sort()) console.log(`  edit  ${path}`);

if (!apply) {
  console.log(`\n${edits.size} file(s), ${renames.length} move(s). Nothing written.`);
  process.exit(0);
}

for (const [path, content] of edits) writeFileSync(path, content);
for (const [from, to] of renames) renameSync(from, to);

console.log(`\nwrote ${edits.size} file(s), moved ${renames.length}.`);
console.log("Now run: bun install && bun run check-types && bun run check-boundaries");
