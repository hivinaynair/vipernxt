import { expect, test } from "bun:test";
import { runtimeFiles, verifyRuntime } from "../agent/lib/runtime.js";

const files: Record<string, string> = {
  ".cursor/hooks.json": JSON.stringify({
    version: 1,
    hooks: { stop: [{ command: "node .cursor/hooks/factory-stop.mjs" }] },
  }),
  ".cursor/hooks/factory-stop.mjs": "hook code",
  ".cursor/factory.json": JSON.stringify({
    callbackUrl: "https://factory.example/callbacks/cursor",
  }),
  ".cursor/environment.json": JSON.stringify({
    build: { dockerfile: "Dockerfile" },
    install: "bun install --frozen-lockfile",
  }),
  ".cursor/Dockerfile": "FROM bun-runtime",
};
const read = async (path: string) => ({ text: files[path], sha: path });
test("matching pinned default-branch runtime passes preflight", async () => {
  await verifyRuntime(runtimeFiles, "approved", "default", "https://factory.example", read);
});
test("hook only on feature branch cannot dispatch", async () => {
  await expect(
    verifyRuntime(
      runtimeFiles,
      "approved",
      "default",
      "https://factory.example",
      async (path, ref) => ({
        ...(await read(path)),
        sha: ref === "default" && path === ".cursor/hooks.json" ? "stale" : path,
      }),
    ),
  ).rejects.toThrow("default-branch runtime differs");
});
test("missing environment pin cannot dispatch", async () => {
  await expect(
    verifyRuntime(runtimeFiles.slice(0, 3), "approved", "default", "https://factory.example", read),
  ).rejects.toThrow("must be pinned");
});
test("npm install is not an approved Cursor setup", async () => {
  await expect(
    verifyRuntime(runtimeFiles, "approved", "default", "https://factory.example", async (path) => ({
      text:
        path === ".cursor/environment.json"
          ? JSON.stringify({ build: { dockerfile: "Dockerfile" }, install: "npm ci" })
          : files[path],
      sha: path,
    })),
  ).rejects.toThrow("bun install --frozen-lockfile");
});
test("wrong callback origin cannot dispatch", async () => {
  await expect(
    verifyRuntime(runtimeFiles, "approved", "default", "https://other.example", read),
  ).rejects.toThrow("callback URL differs");
});
