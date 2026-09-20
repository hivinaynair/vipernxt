import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Persist intent before the network mutation. An uncertain create must be reconciled,
// never retried blindly. CLI output is captured and never echoed (it may contain keys).
export async function setupClerk(
  root: string,
  product: string,
  existingApp?: string,
  run = invoke,
) {
  const dir = resolve(root, ".clerk");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const receipt = resolve(dir, "provisioning.json");
  const saved = existsSync(receipt) ? JSON.parse(readFileSync(receipt, "utf8")) : {};
  let appId = existingApp || saved.appId;
  const save = (value: object) => writeFileSync(receipt, JSON.stringify(value), { mode: 0o600 });
  const validId = (id: unknown): id is string =>
    typeof id === "string" && /^app_[a-zA-Z0-9]+$/.test(id);
  if (appId && !validId(appId)) throw new Error("Invalid Clerk application ID.");
  const cwd = existsSync(resolve(root, "apps/web/package.json")) ? resolve(root, "apps/web") : root;
  if (!appId) {
    if (saved.status === "creating")
      throw new Error(
        "Previous Clerk creation is uncertain. Reconcile with clerk apps list; set CLERK_APP_ID before retrying.",
      );
    const identity = JSON.parse(await run(["whoami", "--json"], cwd));
    if (!identity.email) throw new Error("Run bunx clerk@3.3.0 auth login before provisioning.");
    if (validId(identity.linked?.appId)) appId = identity.linked.appId;
    else {
      save({ status: "creating", product });
      const created = JSON.parse(await run(["apps", "create", product, "--json"], cwd));
      appId = created.application_id;
      if (!validId(appId))
        throw new Error("Creation response missing app ID; reconcile before retrying.");
    }
  }
  save({ status: "created", appId, product });
  await run(["link", "--app", appId], cwd);
  await run(["env", "pull", "--app", appId, "--instance", "dev", "--file", ".env.local"], cwd);
  save({ status: "configured", appId, product });
  return appId;
}
async function invoke(args: string[], cwd: string) {
  const process = Bun.spawn(["bunx", "clerk@3.3.0", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [output, , code] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (code !== 0)
    throw new Error(
      `Clerk ${args[0]} failed (exit ${code}); check CLI login/permissions and retry. Raw output withheld.`,
    );
  return output;
}
if (import.meta.main) {
  try {
    const product = process.argv[2];
    if (!product) throw new Error("Product name required.");
    // biome-ignore lint/suspicious/noUndeclaredEnvVars: standalone provisioning CLI, never a cached Turbo task.
    const appId = await setupClerk(process.cwd(), product, process.env.CLERK_APP_ID);
    console.log(
      `Clerk ${appId}: development keys written locally. Cloud secrets and test identities still require configuration.`,
    );
  } catch (error) {
    console.error(
      error instanceof SyntaxError
        ? "Invalid Clerk response; reconcile provisioning receipt before retrying."
        : (error as Error).message,
    );
    process.exit(1);
  }
}
