#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  configIssues,
  FIELDS,
  readFactoryConfig,
  redact,
  runtimeEntries,
  saveFactoryConfig,
} from "./lib/factory-config";

const root = join(import.meta.dir, "..");
const factory = join(root, "deploy/eve");
const [command = "init", ...flags] = process.argv.slice(2);
const config = readFactoryConfig(root);

async function request(url: string, token: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!response.ok)
    throw new Error(
      `Provider request failed (HTTP ${response.status}); check access and retry explicitly`,
    );
  return response.json();
}
function requireCloud() {
  const issues = configIssues(config, "cloud", flags.includes("--slack"));
  if (issues.length) throw new Error(issues.join("\n"));
}
async function cli(args: string[], cwd = factory) {
  const child = Bun.spawn(
    [
      "bunx",
      "vercel@62.1.0",
      ...args,
      ...(config.VERCEL_TOKEN ? ["--token", config.VERCEL_TOKEN] : []),
      ...(config.VERCEL_TEAM_ID ? ["--scope", config.VERCEL_TEAM_ID] : []),
    ],
    { cwd, stdout: "pipe", stderr: "pipe", env: { ...process.env, ...config } },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  console.log(redact(stdout, config));
  if (code) throw new Error(redact(stderr, config) || `Vercel CLI failed (${code})`);
}
function project() {
  const path = join(factory, ".vercel/project.json");
  const linked = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  if (
    config.FACTORY_PROJECT_ID &&
    linked.projectId &&
    config.FACTORY_PROJECT_ID !== linked.projectId
  )
    throw new Error("Factory project ID differs from the linked project; relink deliberately");
  const projectId = config.FACTORY_PROJECT_ID ?? linked.projectId;
  if (!projectId) throw new Error("Run bun run factory:link first, or set FACTORY_PROJECT_ID");
  if (config.VERCEL_TEAM_ID && linked.orgId && config.VERCEL_TEAM_ID !== linked.orgId)
    throw new Error("Factory team differs from the linked team");
  const teamId = config.VERCEL_TEAM_ID ?? linked.orgId;
  return { projectId, query: teamId ? `?teamId=${encodeURIComponent(teamId)}` : "" };
}

export function planEnvironment(
  entries: ReturnType<typeof runtimeEntries>,
  existing: {
    id: string;
    key: string;
    target?: string | string[];
    customEnvironmentIds?: string[];
    type?: string;
    configurationId?: string;
  }[],
) {
  return entries.map((entry) => {
    const targets = (e: (typeof existing)[number]) =>
      Array.isArray(e.target) ? e.target : e.target ? [e.target] : [];
    const matches = existing.filter(
      (e) => e.key === entry.key && targets(e).includes("production"),
    );
    if (
      matches.length > 1 ||
      matches.some(
        (e) => targets(e).some((t) => t !== "production") || e.customEnvironmentIds?.length,
      )
    )
      throw new Error(`Separate the production environment entry for ${entry.key} before syncing`);
    if (matches.some((e) => e.type === "system" || e.configurationId))
      throw new Error(`Provider-managed ${entry.key} must be configured through its integration`);
    return { entry, id: matches[0]?.id };
  });
}

export async function syncEnvironment(
  plan: ReturnType<typeof planEnvironment>,
  write: (change: ReturnType<typeof planEnvironment>[number]) => Promise<{
    created?:
      | { key?: string; target?: string | string[] }
      | { key?: string; target?: string | string[] }[];
    failed?: unknown[];
    key?: string;
    target?: string | string[];
  }>,
) {
  for (const change of plan) {
    const response = await write(change);
    const confirmed = change.id
      ? response
      : Array.isArray(response.created)
        ? response.created[0]
        : response.created;
    const target = confirmed?.target;
    const targets = Array.isArray(target) ? target : target ? [target] : [];
    if (
      response.failed?.length ||
      confirmed?.key !== change.entry.key ||
      targets.length !== 1 ||
      targets[0] !== "production"
    )
      throw new Error(`Unconfirmed sync for ${change.entry.key}; check Vercel before retrying`);
    console.log(`Synced ${change.entry.key}`);
  }
}

async function main() {
  if (command === "init") {
    const file = join(root, ".env.factory.local");
    if (existsSync(file)) console.log("Kept your existing .env.factory.local");
    else {
      saveFactoryConfig(root, { FACTORY_BASE_BRANCH: "staging" });
      console.log(
        "Created private .env.factory.local. Fill it from .env.factory.example; no services were created.",
      );
    }
    console.log(
      "Start shaping with /next. Cloud credentials are needed only for hosted implementation. Guide: docs/START.md",
    );
  } else if (command === "doctor") {
    const issues = configIssues(
      config,
      flags.includes("--stage=shape") ? "shape" : "cloud",
      flags.includes("--slack"),
    );
    for (const f of FIELDS) console.log(`${f.name}: ${config[f.name] ? "configured" : "not set"}`);
    if (issues.length)
      throw new Error(`${issues.join("\n")}\nSee .env.factory.example and docs/START.md`);
    console.log(
      "Configuration passes. This does not verify provider access, Connect installation or the Cursor Build.",
    );
  } else if (command === "verify") {
    for (const name of ["CURSOR_API_KEY", "VERCEL_TOKEN", "AI_GATEWAY_API_KEY"] as const) {
      if (!config[name])
        throw new Error(`Missing ${name}; fill .env.factory.local before verification`);
    }
    await request("https://api.cursor.com/v1/models", config.CURSOR_API_KEY ?? "");
    console.log("Cursor: authenticated API access verified");
    await request("https://api.vercel.com/v2/user", config.VERCEL_TOKEN ?? "");
    console.log("Vercel: deployment account access verified");
    console.log(
      "AI Gateway: key configured; model entitlement and Jev availability require an actual inference, which this read-only check does not perform",
    );
    if (config.SLACK_BOT_TOKEN) {
      const result = await request("https://slack.com/api/auth.test", config.SLACK_BOT_TOKEN, {
        method: "POST",
      });
      if (!result.ok) throw new Error("Slack rejected the bot token");
      console.log(
        "Slack: bot token verified; signing secret, channel access and live callbacks still need the Slack guide checks",
      );
    }
    console.log(
      "Next: verify GitHub Connect repository access and the active Cursor Build using docs/START.md.",
    );
  } else if (command === "link") {
    if (!config.VERCEL_TOKEN || !config.FACTORY_PROJECT_NAME)
      throw new Error("Set VERCEL_TOKEN and FACTORY_PROJECT_NAME before linking");
    if (!/^[a-z0-9][a-z0-9-]*$/.test(config.FACTORY_PROJECT_NAME))
      throw new Error("FACTORY_PROJECT_NAME must be a lowercase Vercel project name");
    await cli(["link", "--yes", "--project", config.FACTORY_PROJECT_NAME]);
    project();
  } else if (command === "env") {
    requireCloud();
    const { projectId, query } = project();
    const base = `https://api.vercel.com`;
    const metadata = await request(
      `${base}/v9/projects/${encodeURIComponent(projectId)}${query}`,
      config.VERCEL_TOKEN ?? "",
    );
    if (config.FACTORY_PROJECT_NAME && metadata.name !== config.FACTORY_PROJECT_NAME)
      throw new Error("Selected project name differs from FACTORY_PROJECT_NAME");
    const existing = await request(
      `${base}/v9/projects/${encodeURIComponent(projectId)}/env${query}`,
      config.VERCEL_TOKEN ?? "",
    );
    const plan = planEnvironment(runtimeEntries(config), existing.envs ?? []);
    for (const change of plan)
      console.log(`${change.id ? "Update" : "Add"} production ${change.entry.key}`);
    if (!flags.includes("--apply")) {
      console.log(
        "Dry run. Add --apply to sync these values. Other keys and targets are preserved.",
      );
      return;
    }
    await syncEnvironment(plan, ({ entry, id }) =>
      request(
        `${base}/${id ? "v9" : "v10"}/projects/${encodeURIComponent(projectId)}/env${id ? `/${encodeURIComponent(id)}` : ""}${query}`,
        config.VERCEL_TOKEN ?? "",
        { method: id ? "PATCH" : "POST", body: JSON.stringify(entry) },
      ),
    );
    console.log("Production configuration synced. Deploy to activate it.");
  } else if (command === "deploy") {
    requireCloud();
    project();
    await cli(["deploy", "--prod", "--yes"]);
  } else if (command === "dev") {
    const child = Bun.spawn(["bun", "run", "dev"], {
      cwd: factory,
      env: { ...process.env, ...config },
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
    });
    process.exitCode = await child.exited;
  } else
    throw new Error(
      "Commands: init, doctor [--stage=shape] [--slack], verify, link, env [--apply], deploy, dev",
    );
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(redact(error instanceof Error ? error.message : "Setup failed", config));
    process.exitCode = 1;
  }
}
