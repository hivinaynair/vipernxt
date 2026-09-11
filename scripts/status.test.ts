#!/usr/bin/env bun
import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(import.meta.dir, "status.ts");
let dir: string | null = null;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = null;
});

function run(args: string[]) {
  return execFileSync("bun", [script, ...args], { encoding: "utf8" });
}

describe("status", () => {
  test("no state file is no engagement", () => {
    dir = mkdtempSync(join(tmpdir(), "status-"));
    const out = run(["--state", join(dir, "missing.yaml")]);
    expect(out).toContain("No engagement is running here.");
  });

  test("splits waiting on you vs the site", () => {
    dir = mkdtempSync(join(tmpdir(), "status-"));
    const path = join(dir, "state.yaml");
    writeFileSync(
      path,
      `engagement:\n  site: North depot\nheld:\n  - id: H1\n    kind: gather\n    who: fde\n    what: Confirm the outcome number\n    status: open\n    raised: 2026-09-01\n  - id: H2\n    kind: gather\n    who: site\n    what: Photograph the incumbent\n    status: open\n    raised: 2026-09-01\nphases:\n  2: { name: field, status: blocked }\n`,
    );
    const out = run(["--state", path]);
    expect(out).toContain("Waiting on you");
    expect(out).toContain("Confirm the outcome number");
    expect(out).toContain("Waiting on the site");
    expect(out).toContain("Photograph the incumbent");
    expect(out).toContain("site: North depot");
  });

  test("names clip and surfaces", () => {
    dir = mkdtempSync(join(tmpdir(), "status-"));
    const path = join(dir, "state.yaml");
    writeFileSync(
      path,
      `engagement:\n  site: North depot\nclip:\n  kind: wrap\nsurfaces: [web, agent]\nphases:\n  3: { name: shape, status: done }\n`,
    );
    const out = run(["--state", path]);
    expect(out).toContain("clip: wrap");
    expect(out).toContain("surfaces: web, agent");
  });

  test("after shape, points at customize", () => {
    dir = mkdtempSync(join(tmpdir(), "status-"));
    const path = join(dir, "state.yaml");
    writeFileSync(
      path,
      `engagement:\n  site: North depot\nclone:\n  customized: pending\n  composed: pending\nphases:\n  3: { name: shape, status: done }\n`,
    );
    const out = run(["--state", path]);
    expect(out).toContain("names the clone next");
  });

  test("after customize, points at compose", () => {
    dir = mkdtempSync(join(tmpdir(), "status-"));
    const path = join(dir, "state.yaml");
    writeFileSync(
      path,
      `engagement:\n  site: North depot\nclip:\n  kind: wrap\nsurfaces: [web, agent]\nclone:\n  customized: done\n  composed: pending\nphases:\n  3: { name: shape, status: done }\n`,
    );
    const out = run(["--state", path]);
    expect(out).toContain("composes the stack next");
  });
});
