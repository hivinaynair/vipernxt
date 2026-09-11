#!/usr/bin/env bun
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const script = join(import.meta.dir, "json-pick.mjs");

function pick(mode, json, arg) {
  return execFileSync("bun", arg ? [script, mode, arg] : [script, mode], {
    encoding: "utf8",
    input: json,
  });
}

describe("json-pick", () => {
  test("project-id from a wrapped list", () => {
    expect(
      pick("project-id", JSON.stringify({ projects: [{ id: "p1", name: "acme" }] }), "acme"),
    ).toBe("p1");
  });

  test("has-db", () => {
    expect(pick("has-db", JSON.stringify({ databases: [{ name: "staging" }] }), "staging")).toBe(
      "yes",
    );
    expect(pick("has-db", JSON.stringify({ databases: [{ name: "staging" }] }), "prod")).toBe("no");
  });

  test("clerk-linked", () => {
    expect(pick("clerk-linked", JSON.stringify({ linked: true }))).toBe("yes");
    expect(pick("clerk-linked", JSON.stringify({ linked: false }))).toBe("no");
  });
});
