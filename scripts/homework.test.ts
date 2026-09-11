#!/usr/bin/env bun
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(import.meta.dir, "homework.mjs");

describe("homework.mjs", () => {
  test("skips ## Closed when building docx", () => {
    const dir = mkdtempSync(join(tmpdir(), "hw-"));
    try {
      const md = join(dir, "q.md");
      const out = join(dir, "q.docx");
      writeFileSync(
        md,
        `# Ask\n\n## Photographs\n\n- [ ] Receipt photo\n\n## Open\n\n- How do they close the day?\n\n## Closed\n\n- Old question that was answered\n`,
      );
      execFileSync("node", [script, "build", md, "--out", out], { encoding: "utf8" });
      const xml = execFileSync("unzip", ["-p", out, "word/document.xml"], {
        encoding: "utf8",
        maxBuffer: 8 * 1024 * 1024,
      });
      expect(xml).toContain("How do they close the day?");
      expect(xml).toContain("Receipt photo");
      expect(xml).not.toContain("Old question that was answered");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
