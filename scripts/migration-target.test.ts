import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { migrationTarget } from "../docs/kit/overlays/db/src/migration-target";

describe("migration target", () => {
  test("uses the workflow's direct URL instead of a local database", () => {
    expect(
      migrationTarget({
        CI: "true",
        DATABASE_URL_UNPOOLED: "postgres://direct",
        DATABASE_URL: "postgres://pool",
      }),
    ).toEqual({ kind: "remote", url: "postgres://direct" });
  });
  test("missing credentials cannot silently migrate local storage in CI or production", () => {
    expect(() => migrationTarget({ CI: "true" })).toThrow("local fallback is disabled");
    expect(() => migrationTarget({ NODE_ENV: "production" })).toThrow();
    expect(migrationTarget({})).toEqual({ kind: "local" });
  });
  test("bare kit has no active database workflow; template supports current migrations", () => {
    const manifestPath = `${import.meta.dir}/../docs/kit/scaffolded.yaml`;
    const selected = existsSync(manifestPath)
      ? (Bun.YAML.parse(readFileSync(manifestPath, "utf8")) as { surfaces: string[] }).surfaces
      : [];
    expect(existsSync(`${import.meta.dir}/../.github/workflows/migrate.yml`)).toBe(
      selected.includes("db"),
    );
    const template = readFileSync(`${import.meta.dir}/../docs/kit/workflows/migrate.yml`, "utf8");
    expect(template).not.toContain("_journal.json");
    expect(template).toContain("bun run --cwd packages/db db:migrate");
  });
});
