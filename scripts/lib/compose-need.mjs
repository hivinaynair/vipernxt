#!/usr/bin/env bun
/**
 * setup.sh asks whether Neon / Clerk / PostHog / Resend / Blob stages run.
 *
 *   bun scripts/lib/compose-need.mjs db|auth|web|analytics|email|files
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
const web = s.has("web");
const need = {
  db: s.has("db"),
  web,
  auth: web && !w.has("auth"),
  analytics: web && !w.has("analytics"),
  email: web && !w.has("email"),
  files: web && !w.has("files"),
};

process.stdout.write(need[q] ? "1" : "0");
