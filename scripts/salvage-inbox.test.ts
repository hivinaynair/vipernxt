#!/usr/bin/env bun
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(import.meta.dir, "salvage-inbox.mjs");

describe("salvage-inbox.mjs", () => {
  test("copies text into pages and writes inventory", () => {
    const dir = mkdtempSync(join(tmpdir(), "pile-"));
    try {
      const src = join(dir, "drop");
      const inbox = join(dir, "inbox");
      mkdirSync(src);
      writeFileSync(join(src, "ledgers.csv"), "date,amount\n2026-01-01,10\n");
      execFileSync("node", [script, src, "--inbox", inbox], { encoding: "utf8" });
      expect(readFileSync(join(inbox, "pages", "ledgers.csv"), "utf8")).toContain("amount");
      const inv = readFileSync(join(inbox, "INVENTORY.md"), "utf8");
      expect(inv).toContain("ledgers.csv");
      expect(inv).toContain("text — read directly");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("unpacks a zip into pages", () => {
    const dir = mkdtempSync(join(tmpdir(), "pile-"));
    try {
      const src = join(dir, "drop");
      const inbox = join(dir, "inbox");
      mkdirSync(src);
      writeFileSync(join(src, "ledgers.csv"), "date,amount\n2026-01-01,10\n");
      const zip = join(dir, "pile.zip");
      execFileSync("zip", ["-q", "-j", zip, join(src, "ledgers.csv")]);
      execFileSync("node", [script, zip, "--inbox", inbox], { encoding: "utf8" });
      expect(readFileSync(join(inbox, "pages", "ledgers.csv"), "utf8")).toContain("amount");
      expect(readFileSync(join(inbox, "INVENTORY.md"), "utf8")).toContain("ledgers.csv");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
