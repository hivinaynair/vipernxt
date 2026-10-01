import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  configIssues,
  type FactoryConfig,
  parseConfig,
  readFactoryConfig,
  redact,
  runtimeEntries,
  saveFactoryConfig,
} from "./lib/factory-config";
import { planEnvironment, syncEnvironment } from "./setup";

const valid: FactoryConfig = {
  CURSOR_API_KEY: "cursor-unit-secret",
  AI_GATEWAY_API_KEY: "gateway-unit-secret",
  VERCEL_TOKEN: "deploy-unit-secret",
  FACTORY_REPO: "owner/product",
  FACTORY_OWNER: "owner",
  FACTORY_BASE_BRANCH: "staging",
  FACTORY_CALLBACK_AUDIENCE: "https://factory.example.com",
  GITHUB_CONNECTOR: "github/product",
};
describe("clone credentials", () => {
  test("parses credentials as data, preserves literals, ignores unrelated environment keys", () => {
    expect(
      parseConfig(
        'CURSOR_API_KEY="$(touch /tmp/should-not-exist)"\nAI_GATEWAY_API_KEY=literal#part\nHOME=/evil',
      ),
    ).toEqual({
      CURSOR_API_KEY: "$(touch /tmp/should-not-exist)",
      AI_GATEWAY_API_KEY: "literal#part",
    });
    expect(() => parseConfig('CURSOR_API_KEY="private-incomplete')).toThrow(
      "Invalid quoted value for CURSOR_API_KEY",
    );
  });
  test("private roundtrip and exported values take precedence", () => {
    const root = mkdtempSync(join(tmpdir(), "factory-config-"));
    try {
      saveFactoryConfig(root, valid);
      expect(statSync(join(root, ".env.factory.local")).mode & 0o777).toBe(0o600);
      expect(readFactoryConfig(root, {})).toEqual(valid);
      expect(readFactoryConfig(root, { CURSOR_API_KEY: "exported" }).CURSOR_API_KEY).toBe(
        "exported",
      );
      expect(readFactoryConfig(root, { CURSOR_API_KEY: "" }).CURSOR_API_KEY).toBe(
        valid.CURSOR_API_KEY,
      );
      const before = readFileSync(join(root, ".env.factory.local"), "utf8");
      rmSync(join(root, ".env.factory.local"));
      symlinkSync(join(root, "other-private-file"), join(root, ".env.factory.local"));
      expect(() => saveFactoryConfig(root, valid)).toThrow("Refusing a symlinked");
      expect(before).toContain("CURSOR_API_KEY");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  test("shaping needs no cloud credentials; cloud and partial Slack fail explicitly", () => {
    expect(configIssues({}, "shape")).toEqual([]);
    expect(configIssues({})).toContain("Missing CURSOR_API_KEY");
    expect(configIssues(valid)).toEqual([]);
    expect(configIssues({ ...valid, SLACK_BOT_TOKEN: "xoxb-test" })).toContain(
      "Missing SLACK_SIGNING_SECRET for interactive Slack",
    );
    expect(
      configIssues({
        ...valid,
        FACTORY_CALLBACK_AUDIENCE: "https://user:password@example.com/path",
      }),
    ).toHaveLength(1);
  });
  test("runtime excludes deployment credentials and errors redact all known secrets", () => {
    const entries = runtimeEntries({
      ...valid,
      FACTORY_PROJECT_ID: "prj_example",
      VERCEL_TEAM_ID: "team_example",
    });
    expect(entries.some((e) => e.key === "VERCEL_TOKEN")).toBe(false);
    expect(entries.some((e) => e.key === "FACTORY_PROJECT_ID")).toBe(false);
    expect(entries.find((e) => e.key === "CURSOR_API_KEY")?.type).toBe("encrypted");
    expect(redact("deploy-unit-secret cursor-unit-secret gateway-unit-secret", valid)).toBe(
      "[redacted] [redacted] [redacted]",
    );
  });
  test("production updates preserve other keys and refuse shared targets", () => {
    const entries = runtimeEntries(valid);
    const plan = planEnvironment(entries, [
      { id: "prod-cursor", key: "CURSOR_API_KEY", target: ["production"] },
      { id: "unrelated", key: "OTHER", target: ["production"] },
    ]);
    expect(plan.find((p) => p.entry.key === "CURSOR_API_KEY")?.id).toBe("prod-cursor");
    expect(plan.some((p) => p.entry.key === "OTHER")).toBe(false);
    expect(() =>
      planEnvironment(entries, [
        { id: "shared", key: "CURSOR_API_KEY", target: ["production", "preview"] },
      ]),
    ).toThrow("Separate the production");
    expect(() =>
      planEnvironment(entries, [
        { id: "one", key: "CURSOR_API_KEY", target: ["production"] },
        { id: "two", key: "CURSOR_API_KEY", target: ["production"] },
      ]),
    ).toThrow();
  });
  test("supports legacy string targets but protects custom and provider-owned values", () => {
    const entries = runtimeEntries(valid);
    expect(
      planEnvironment(entries, [{ id: "legacy", key: "CURSOR_API_KEY", target: "production" }])[0]
        .id,
    ).toBe("legacy");
    expect(() =>
      planEnvironment(entries, [
        {
          id: "shared",
          key: "CURSOR_API_KEY",
          target: ["production"],
          customEnvironmentIds: ["custom"],
        },
      ]),
    ).toThrow("Separate");
    expect(() =>
      planEnvironment(entries, [
        { id: "managed", key: "CURSOR_API_KEY", target: ["production"], type: "system" },
      ]),
    ).toThrow("Provider-managed");
  });
  test("HTTP success with a failed create never reports sync or writes subsequent keys", async () => {
    const plan = planEnvironment(runtimeEntries(valid), []);
    let writes = 0;
    await expect(
      syncEnvironment(plan, async () => {
        writes++;
        return { failed: [{ error: "provider refusal" }] };
      }),
    ).rejects.toThrow("Unconfirmed sync for CURSOR_API_KEY");
    expect(writes).toBe(1);
  });
  test("lost write response stops without blind retries", async () => {
    let writes = 0;
    await expect(
      syncEnvironment(planEnvironment(runtimeEntries(valid), []), async () => {
        writes++;
        throw new Error("Connection lost");
      }),
    ).rejects.toThrow("Connection lost");
    expect(writes).toBe(1);
  });
  test("create and update require the confirmed key and production scope", async () => {
    const entries = runtimeEntries(valid).slice(0, 2);
    const plan = planEnvironment(entries, [
      { id: "update", key: "AI_GATEWAY_API_KEY", target: ["production"] },
    ]);
    const writes: string[] = [];
    await syncEnvironment(plan, async ({ entry, id }) => {
      writes.push(id ?? "create");
      return id
        ? { key: entry.key, target: "production" }
        : { created: { key: entry.key, target: ["production"] }, failed: [] };
    });
    expect(writes).toEqual(["create", "update"]);
    await expect(
      syncEnvironment(plan.slice(0, 1), async () => ({
        created: { key: "OTHER", target: ["production"] },
        failed: [],
      })),
    ).rejects.toThrow("Unconfirmed sync");
  });
});
