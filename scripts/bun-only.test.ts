#!/usr/bin/env bun
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(mjs|ts|sh)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

describe("bun-only", () => {
  test("no kit script asks for node or python3", () => {
    const files = [...walk(join(root, "scripts")), join(root, ".agents/skills/setup/setup.sh")];
    for (const abs of files) {
      const text = readFileSync(abs, "utf8");
      expect(text, abs).not.toMatch(/^#!\/usr\/bin\/env node/m);
      expect(text, abs).not.toMatch(/\bpython3\b/);
      expect(text, abs).not.toMatch(/\bnode scripts\//);
    }
  });
});
