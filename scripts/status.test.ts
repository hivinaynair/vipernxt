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

describe("a stopped engagement", () => {
  function state(yaml: string) {
    dir = mkdtempSync(join(tmpdir(), "status-"));
    const path = join(dir, "state.yaml");
    writeFileSync(path, yaml);
    return run(["--state", path]);
  }

  test("reports the stop and nothing else", () => {
    // It used to print Stopped and then carry on with "Waiting on you" and
    // "next: research", which contradicts the stop.
    const out = state(
      `size: engagement\noutcome:\n  kind: buy-instead\n  why: seven vendors already ship this\n  date: 2026-09-11\nheld:\n  - id: H1\n    kind: gather\n    who: fde\n    what: Who is the customer?\n    status: open\nphases:\n  0: { name: salvage, status: blocked }\n  1: { name: research, status: pending }\n`,
    );
    expect(out).toContain("**Stopped**");
    expect(out).toContain("buy-instead (2026-09-11)");
    expect(out).toContain("seven vendors already ship this");
    expect(out).not.toContain("Waiting on you");
    expect(out).not.toContain("next:");
    expect(out).toContain("Reopen by clearing");
  });

  test("says so when a stop has no recorded reason", () => {
    const out = state(`size: engagement\noutcome:\n  kind: parked\nphases: {}\n`);
    expect(out).toContain("no reason recorded");
  });

  test("an engagement still gets its real next phase", () => {
    const out = state(
      `size: engagement\nengagement:\n  site: North depot\nphases:\n  1: { name: research, status: done }\n  2: { name: field, status: pending }\n`,
    );
    expect(out).toContain("next: field");
  });

  test("an engagement that has not stopped still reports normally", () => {
    const out = state(
      `size: engagement\nengagement:\n  site: North depot\nphases:\n  0: { name: salvage, status: blocked }\n  1: { name: research, status: pending }\n`,
    );
    expect(out).not.toContain("**Stopped**");
    expect(out).toContain("site: North depot");
  });
});
