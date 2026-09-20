/** Real Playwright evidence: missing runner, zero executed tests or failures reject the stage. */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { save } from "./core";

const environment = process.env;
const output = environment.FACTORY_BROWSER_RECEIPT;
const tree = environment.FACTORY_TREE;
if (!output || !tree) throw new Error("Browser verification must run in a factory attempt");
const binary = resolve("node_modules/.bin/playwright");
if (!existsSync(binary))
  throw new Error("Install and configure Playwright before dispatching a web slice");
const report = join(environment.FACTORY_ATTEMPT_DIR ?? ".", "playwright.json");
const child = spawn(binary, ["test", ...process.argv.slice(2), "--reporter=json"], {
  stdio: ["ignore", "inherit", "inherit"],
  env: { ...environment, PLAYWRIGHT_JSON_OUTPUT_FILE: report },
});
const code = await new Promise<number | null>((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", resolve);
});
if (code !== 0) throw new Error(`Playwright exited ${code}`);
const data = JSON.parse(readFileSync(report, "utf8")) as {
  stats?: { expected?: number; unexpected?: number; flaky?: number };
};
const cases = data.stats?.expected ?? 0;
if (cases < 1 || data.stats?.unexpected !== 0 || data.stats?.flaky !== 0)
  throw new Error("Browser evidence requires executed, passing, non-flaky scenarios");
save(output, { tree, passed: true, cases, report });
