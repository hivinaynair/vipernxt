import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { Linear } from "./controller/linear";
import { type Config, Controller } from "./controller/service";
import { read } from "./factory/core";

const env = process.env;
function required(key: string) {
  const v = env[key];
  if (!v) throw new Error(`Missing ${key}`);
  return v;
}
const config = env.FACTORY_CONFIG_JSON
  ? (JSON.parse(env.FACTORY_CONFIG_JSON) as Config)
  : read<Config>(required("FACTORY_CONFIG"));
config.data = resolve(env.FACTORY_DATA ?? "/data");
config.token = required("FACTORY_CONTROL_TOKEN");
config.webhookSecret = required("LINEAR_WEBHOOK_SECRET");
config.clientId = required("LINEAR_CLIENT_ID");
if (
  config.token.length < 32 ||
  !config.users?.length ||
  !config.workspace ||
  !Object.keys(config.teams ?? {}).length
)
  throw new Error("Configure a strong control token and explicit user/team/workspace allowlists");
mkdirSync(config.data, { recursive: true, mode: 0o700 });
// Dedicated lock database: the service database must remain free for event transactions.
const mutex = new Database(`${config.data}/service-lock.sqlite`);
mutex.exec("BEGIN IMMEDIATE");
const port = Number(env.PORT ?? 8080);
const linear = new Linear(config.clientId, required("LINEAR_CLIENT_SECRET"));
const identity = await linear.identity();
if (identity.organization.id !== config.workspace)
  throw new Error("Linear OAuth app belongs to another workspace");
config.appUserId = identity.viewer.id;
config.mentionUrl = identity.viewer.url;
const controller = new Controller(config, linear, `http://127.0.0.1:${port}`);
const server = Bun.serve({
  port,
  hostname: "0.0.0.0",
  maxRequestBodySize: 1024 * 1024,
  idleTimeout: 120,
  fetch: async (r) => {
    const response = await controller.handle(r);
    if (new URL(r.url).pathname === "/webhooks/linear")
      console.log(
        JSON.stringify({
          event: "linear-webhook",
          status: response.status,
          outcome: await response.clone().text(),
        }),
      );
    return response;
  },
});
const inboxTimer = setInterval(() => {
  void controller.pump().catch(() => console.error("Linear communication pending retry"));
}, 1000);
let failed = false;
const timer = setInterval(() => {
  void controller
    .tick()
    .then(() => {
      failed = false;
    })
    .catch(() => {
      if (!failed)
        console.error("Controller reconciliation failed; retaining queued work for retry");
      failed = true;
    });
}, 1000);
console.log(`Factory controller listening on ${port}`);
async function stop() {
  clearInterval(timer);
  clearInterval(inboxTimer);
  await server.stop();
  controller.store.close();
  mutex.close();
  process.exit(0);
}
process.once("SIGTERM", () => {
  void stop();
});
process.once("SIGINT", () => {
  void stop();
});
