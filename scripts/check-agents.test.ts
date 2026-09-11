#!/usr/bin/env bun
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const jobsDir = join(root, ".agents/agents");
const adaptersDir = join(root, ".cursor/agents");

function markdownNames(dir: string) {
  return readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "README.md");
}

describe("parallel jobs", () => {
  test("jobs are host-agnostic; Cursor adapters are thin pointers", () => {
    const jobs = markdownNames(jobsDir);
    expect(jobs.length).toBeGreaterThan(0);

    for (const file of jobs) {
      const job = readFileSync(join(jobsDir, file), "utf8");
      expect(job, file).not.toMatch(/Cursor Grok/);
      expect(job, file).not.toMatch(/Gemini/);
      expect(job, file).toMatch(/^---\nname: /);

      const adapterPath = join(adaptersDir, file);
      expect(existsSync(adapterPath), `${file} needs a Cursor adapter`).toBe(true);
      const adapter = readFileSync(adapterPath, "utf8");
      expect(adapter).toContain(`.agents/agents/${file}`);
      expect(adapter).toMatch(/model:\s*cursor-grok-4\.6/);
      expect(adapter).toContain("This is the Cursor adapter");
      expect(adapter.split("\n").length).toBeLessThan(25);
    }
  });

  test("no Cursor adapter without a job", () => {
    const jobs = new Set(markdownNames(jobsDir));
    for (const file of markdownNames(adaptersDir)) {
      expect(jobs.has(file), `${file} has no .agents/agents job`).toBe(true);
    }
  });
});
