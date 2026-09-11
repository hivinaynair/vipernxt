#!/usr/bin/env bun
import { describe, expect, test } from "bun:test";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const adaptersDir = join(root, ".cursor/agents");
const jobs = [
  "salvage-miner",
  "pile-reader",
  "domain-researcher",
  "spine-checker",
  "ui-gate-auditor",
];

describe("parallel child jobs", () => {
  test("jobs are skills every harness scans; Cursor adapters are thin pointers", () => {
    for (const name of jobs) {
      const skillPath = join(root, ".agents/skills", name, "SKILL.md");
      expect(existsSync(skillPath), skillPath).toBe(true);
      const skill = readFileSync(skillPath, "utf8");
      expect(skill, name).toMatch(new RegExp(`^---\\nname: ${name}\\n`));
      expect(skill, name).not.toMatch(/Cursor Grok/);
      expect(skill, name).not.toMatch(/Gemini/);

      const adapterPath = join(adaptersDir, `${name}.md`);
      expect(existsSync(adapterPath), `${name} needs a Cursor adapter`).toBe(true);
      const adapter = readFileSync(adapterPath, "utf8");
      expect(adapter).toContain(`.agents/skills/${name}/SKILL.md`);
      expect(adapter).toMatch(/model:\s*cursor-grok-4\.6/);
      expect(adapter).toContain("This is the Cursor adapter");
      expect(adapter.split("\n").length).toBeLessThan(25);

      for (const host of [".cursor/skills", ".claude/skills"] as const) {
        const link = join(root, host, name);
        expect(existsSync(link), `${host}/${name} symlink`).toBe(true);
        expect(lstatSync(link).isSymbolicLink(), `${host}/${name} is a symlink`).toBe(true);
      }
    }
  });

  test("no Cursor adapter without a skill", () => {
    const jobSet = new Set(jobs);
    for (const file of readdirSync(adaptersDir).filter((f) => f.endsWith(".md"))) {
      expect(jobSet.has(file.replace(/\.md$/, "")), `${file} has no skill`).toBe(true);
    }
  });

  test("no leftover .agents/agents job folder", () => {
    expect(existsSync(join(root, ".agents/agents"))).toBe(false);
  });
});
