#!/usr/bin/env bun
/**
 * setup.sh asks whether Neon / Clerk stages run.
 *
 *   bun scripts/lib/compose-need.mjs db|auth|web
 *
 * Prints 1 or 0. No composed.yaml → 1 (fat provision, same as before).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const q = process.argv[2];
const cwd = process.argv[3] ?? process.cwd();
const p = join(cwd, "docs/kit/composed.yaml");

if (!existsSync(p)) {
  process.stdout.write("1");
  process.exit(0);
}

const c = Bun.YAML.parse(readFileSync(p, "utf8"));
const s = new Set(c.surfaces ?? []);
const w = new Set(c.without ?? []);
const need = {
  db: s.has("db"),
  web: s.has("web"),
  auth: s.has("web") && !w.has("auth"),
};

process.stdout.write(need[q] ? "1" : "0");
