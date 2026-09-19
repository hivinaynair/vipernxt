import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// The repository lease must outlive any invocation that could own it.
// Set the limit in Build Output API metadata, including generated workflow routes.
let count = 0;
function walk(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) walk(path);
    else if (item.name === ".vc-config.json") {
      const config = JSON.parse(readFileSync(path, "utf8"));
      if (String(config.runtime).startsWith("nodejs")) {
        config.maxDuration = 60;
        writeFileSync(path, JSON.stringify(config, null, 2));
        count++;
      }
    }
  }
}
for (const dir of [".vercel/output/functions", ".output/functions"]) if (existsSync(dir)) walk(dir);
if (process.env.VERCEL === "1" && count === 0)
  throw new Error("No function duration metadata found; refusing unsafe deployment");
console.log(`Applied 60s invocation limit to ${count} Vercel function configs`);
