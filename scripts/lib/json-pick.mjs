#!/usr/bin/env bun
/**
 * JSON helpers for setup.sh. Reads stdin, prints one value.
 *
 *   neonctl projects list --output json | bun scripts/lib/json-pick.mjs project-id <name>
 *   neonctl databases list --output json | bun scripts/lib/json-pick.mjs has-db <name>
 *   clerk whoami | bun scripts/lib/json-pick.mjs clerk-linked
 */
const mode = process.argv[2];
const arg = process.argv[3];
let data;
try {
  data = await Bun.stdin.json();
} catch {
  process.exit(0);
}

if (mode === "project-id") {
  const ps = Array.isArray(data) ? data : (data?.projects ?? data);
  const list = Array.isArray(ps) ? ps : [];
  process.stdout.write(String(list.find((p) => p?.name === arg)?.id ?? ""));
} else if (mode === "has-db") {
  const dbs = Array.isArray(data) ? data : (data?.databases ?? data);
  const list = Array.isArray(dbs) ? dbs : [];
  process.stdout.write(list.some((d) => d?.name === arg) ? "yes" : "no");
} else if (mode === "clerk-linked") {
  process.stdout.write(data?.linked ? "yes" : "no");
} else {
  console.error("usage: json-pick.mjs project-id <name> | has-db <name> | clerk-linked");
  process.exit(1);
}
