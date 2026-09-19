// Install as .cursor/hooks/factory-stop.mjs. Cursor invokes this command hook.
import { appendFileSync, realpathSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function diagnostic(message) {
  console.error(`Factory stop hook: ${message}`);
  try {
    appendFileSync(
      resolve(tmpdir(), "vipernxt-factory-hook.jsonl"),
      JSON.stringify({ at: new Date().toISOString(), message }) + "\n",
      { mode: 0o600 },
    );
  } catch {
    /* Diagnostics must not prevent delivery. */
  }
}

export async function notifyStop(input, dependencies = {}) {
  const env = dependencies.env ?? process.env;
  const log = dependencies.log ?? diagnostic;
  const exists =
    dependencies.exists ??
    (async (path) =>
      stat(path)
        .then((s) => s.isSocket())
        .catch(() => false));
  const mint = dependencies.mint ?? mintToken;
  const send = dependencies.send ?? fetch;
  const wait = dependencies.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  if (
    input?.hook_event_name !== "stop" ||
    !["completed", "aborted", "error"].includes(input.status)
  ) {
    throw new Error("Invalid Cursor stop event");
  }
  log(`received ${input.status}`);
  // Cursor documents this fixed socket for managed VMs. Hooks may have a
  // different environment from an agent shell, so do not silently skip it.
  const socket = env.CURSOR_AGENT_SOCKET || "/run/cursor/api.sock";
  if (!(await exists(socket))) {
    log("identity socket unavailable; no callback sent");
    return {};
  }
  const configPath = env.CURSOR_PROJECT_DIR
    ? resolve(env.CURSOR_PROJECT_DIR, ".cursor/factory.json")
    : fileURLToPath(new URL("../factory.json", import.meta.url));
  const config = dependencies.config ?? JSON.parse(await readFile(configPath, "utf8"));
  const endpoint = new URL(config.callbackUrl);
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.pathname !== "/callbacks/cursor" ||
    endpoint.search ||
    endpoint.hash
  ) {
    throw new Error("Invalid factory callback endpoint");
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const token = await mint(socket, endpoint.origin);
      const response = await send(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ event: "stop", status: input.status }),
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
      log(`callback HTTP ${response.status}`);
      if (response.ok) return {};
      if (response.status === 401 || response.status === 403) break;
    } catch {
      log("identity or callback transport failed");
    }
    if (attempt < 2) await wait(1000);
  }
  throw new Error("Callback not acknowledged; durable deadline remains active");
}

function mintToken(socket, audience) {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        socketPath: socket,
        path: "/v1/tokens/oidc",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        timeout: 5000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
          if (data.length > 20000) req.destroy(new Error("Identity response too large"));
        });
        res.on("error", () => reject(new Error("Identity unavailable")));
        res.on("end", () => {
          try {
            if (res.statusCode !== 200) throw new Error("Identity unavailable");
            const token = JSON.parse(data).token;
            if (typeof token !== "string" || !token) throw new Error("Identity unavailable");
            resolve(token);
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

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  diagnostic("process started");
  try {
    let raw = "";
    for await (const chunk of process.stdin) {
      raw += chunk;
      if (raw.length > 65536) throw new Error("Hook input too large");
    }
    const input = JSON.parse(raw);
    diagnostic("stdin parsed");
    await notifyStop(input);
  } catch {
    diagnostic("failed; durable deadline remains active");
    process.exitCode = 1;
  } finally {
    // No followup_message: this hook must never cause another model turn.
    process.stdout.write("{}\n");
  }
}
