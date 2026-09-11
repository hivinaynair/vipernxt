#!/usr/bin/env bun
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(import.meta.dir, "compose-need.mjs");

function ask(cwd: string, q: string) {
  return execFileSync("bun", [script, q, cwd], { encoding: "utf8" });
}

describe("compose-need", () => {
  test("no composed.yaml means fat setup", () => {
    const dir = mkdtempSync(join(tmpdir(), "need-"));
    try {
      expect(ask(dir, "db")).toBe("1");
      expect(ask(dir, "auth")).toBe("1");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("honours surfaces and --without auth", () => {
    const dir = mkdtempSync(join(tmpdir(), "need-"));
    try {
      mkdirSync(join(dir, "docs/kit"), { recursive: true });
      writeFileSync(
        join(dir, "docs/kit/composed.yaml"),
        "surfaces: [web, ui, db]\nwithout: [auth, jobs]\n",
      );
      expect(ask(dir, "db")).toBe("1");
      expect(ask(dir, "web")).toBe("1");
      expect(ask(dir, "auth")).toBe("0");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
