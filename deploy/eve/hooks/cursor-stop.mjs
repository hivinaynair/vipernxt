// Install as .cursor/hooks/factory-stop.mjs in the product repository.
// Only an authenticated wake-up is sent. No logs, secrets, or success verdicts.
import { readFile } from "node:fs/promises";
import { request } from "node:http";

if (!process.env.CURSOR_AGENT_SOCKET) process.exit(0);
const config = JSON.parse(await readFile(".cursor/factory.json", "utf8"));
const endpoint = new URL(config.callbackUrl);
if (
  endpoint.protocol !== "https:" ||
  endpoint.username ||
  endpoint.password ||
  endpoint.pathname !== "/callbacks/cursor"
)
  throw new Error("Invalid factory callback endpoint");
const audience = endpoint.origin;
async function mint() {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        socketPath: process.env.CURSOR_AGENT_SOCKET,
        path: "/v1/tokens/oidc",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        timeout: 5000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
          if (data.length > 20000) req.destroy();
        });
        res.on("end", () => {
          try {
            if (res.statusCode !== 200) throw new Error("Identity unavailable");
            resolve(JSON.parse(data).token);
          } catch {
            reject(new Error("Identity unavailable"));
          }
        });
      },
    );
    req.on("error", () => reject(new Error("Identity unavailable")));
    req.on("timeout", () => req.destroy(new Error("Identity timeout")));
    req.end(JSON.stringify({ aud: audience }));
  });
}
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    const token = await mint();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) process.exit(0);
    if (response.status === 401 || response.status === 403) break;
  } catch {
    /* No bearer token or response body enters agent logs. */
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
console.error("Factory callback not acknowledged; durable deadline will reconcile the run.");
process.exitCode = 1;
