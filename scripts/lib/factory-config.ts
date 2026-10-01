import { chmodSync, existsSync, lstatSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const FIELDS = [
  { name: "CURSOR_API_KEY", secret: true, help: "Cursor Settings → Cloud Agents → API keys" },
  {
    name: "AI_GATEWAY_API_KEY",
    secret: true,
    help: "Vercel AI Gateway → API keys (Eve and Jev model access)",
  },
  {
    name: "VERCEL_TOKEN",
    secret: true,
    help: "Vercel Account Settings → Tokens (deployment, not model access)",
  },
  { name: "FACTORY_REPO", secret: false, help: "Product repository as owner/repo" },
  { name: "FACTORY_OWNER", secret: false, help: "GitHub login for owner holds" },
  {
    name: "FACTORY_CALLBACK_AUDIENCE",
    secret: false,
    help: "Stable HTTPS factory origin, e.g. https://my-factory.vercel.app",
  },
  {
    name: "GITHUB_CONNECTOR",
    secret: false,
    help: "Vercel Connect GitHub connector reference, e.g. github/my-product",
  },
  { name: "FACTORY_PROJECT_NAME", secret: false, help: "Your Vercel factory project name" },
  {
    name: "FACTORY_BASE_BRANCH",
    secret: false,
    help: "Product integration branch, normally staging",
  },
  { name: "FACTORY_PROJECT_ID", secret: false, help: "Optional existing factory project ID" },
  { name: "VERCEL_TEAM_ID", secret: false, help: "Optional Vercel team ID" },
  { name: "SLACK_BOT_TOKEN", secret: true, help: "Slack app Bot User OAuth Token" },
  { name: "SLACK_SIGNING_SECRET", secret: true, help: "Slack app Signing Secret" },
  { name: "SLACK_OWNER_CHANNEL", secret: false, help: "Slack channel ID; invite the bot" },
  { name: "SLACK_OWNER_USER_ID", secret: false, help: "Owner's Slack member ID" },
  {
    name: "SLACK_OWNER_WEBHOOK",
    secret: true,
    help: "Optional incoming webhook for text-only alerts",
  },
  { name: "FACTORY_MODEL", secret: false, help: "Optional AI Gateway coordinator model ID" },
] as const;
export type FactoryConfig = Partial<Record<(typeof FIELDS)[number]["name"], string>>;
export const RUNTIME_NAMES = FIELDS.map((f) => f.name).filter(
  (n) =>
    !["VERCEL_TOKEN", "FACTORY_PROJECT_ID", "FACTORY_PROJECT_NAME", "VERCEL_TEAM_ID"].includes(n),
);

/** Parse data only: never source an env file or execute substitutions. */
export function parseConfig(text: string): FactoryConfig {
  const result: FactoryConfig = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || !FIELDS.some((f) => f.name === match[1])) continue;
    let value = match[2];
    if (value.startsWith('"')) {
      try {
        value = JSON.parse(value);
      } catch {
        throw new Error(`Invalid quoted value for ${match[1]}`);
      }
      if (typeof value !== "string") throw new Error(`Invalid value for ${match[1]}`);
    } else if (value.startsWith("'")) {
      if (!value.endsWith("'")) throw new Error(`Invalid quoted value for ${match[1]}`);
      value = value.slice(1, -1);
    } else value = value.replace(/\s+#.*$/, "");
    if (/[\r\n\0]/.test(value)) throw new Error(`Multiline value is not supported for ${match[1]}`);
    if (value) result[match[1] as keyof FactoryConfig] = value;
  }
  return result;
}
export function readFactoryConfig(
  root: string,
  environment: Record<string, string | undefined> = process.env,
): FactoryConfig {
  const file = join(root, ".env.factory.local");
  const config = existsSync(file) ? parseConfig(readFileSync(file, "utf8")) : {};
  for (const { name } of FIELDS) if (environment[name]) config[name] = environment[name];
  return config;
}
export function saveFactoryConfig(root: string, config: FactoryConfig) {
  const path = join(root, ".env.factory.local");
  try {
    if (lstatSync(path).isSymbolicLink())
      throw new Error("Refusing a symlinked .env.factory.local");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  writeFileSync(
    path,
    `# Private factory configuration; never commit.\n${FIELDS.map((f) => `${f.name}=${JSON.stringify(config[f.name] ?? "")}`).join("\n")}\n`,
    { mode: 0o600 },
  );
  chmodSync(path, 0o600);
}
export function configIssues(
  config: FactoryConfig,
  stage: "shape" | "cloud" = "cloud",
  slack = false,
): string[] {
  if (stage === "shape") return [];
  const required = [
    "CURSOR_API_KEY",
    "AI_GATEWAY_API_KEY",
    "VERCEL_TOKEN",
    "FACTORY_REPO",
    "FACTORY_BASE_BRANCH",
    "FACTORY_OWNER",
    "FACTORY_CALLBACK_AUDIENCE",
    "GITHUB_CONNECTOR",
  ] as const;
  const issues: string[] = required.filter((n) => !config[n]).map((n) => `Missing ${n}`);
  if (config.FACTORY_REPO && !/^[\w.-]+\/[\w.-]+$/.test(config.FACTORY_REPO))
    issues.push("FACTORY_REPO must be owner/repo");
  if (config.FACTORY_OWNER && !/^[A-Za-z0-9-]{1,39}$/.test(config.FACTORY_OWNER))
    issues.push("FACTORY_OWNER must be a GitHub login");
  if (
    config.FACTORY_BASE_BRANCH &&
    !/^[A-Za-z0-9][A-Za-z0-9_./-]*$/.test(config.FACTORY_BASE_BRANCH)
  )
    issues.push("Invalid FACTORY_BASE_BRANCH");
  if (config.GITHUB_CONNECTOR && !/^github\/[\w.-]+$/.test(config.GITHUB_CONNECTOR))
    issues.push("GITHUB_CONNECTOR must be a github/name reference");
  if (config.FACTORY_CALLBACK_AUDIENCE) {
    try {
      const url = new URL(config.FACTORY_CALLBACK_AUDIENCE);
      if (
        url.protocol !== "https:" ||
        url.origin !== config.FACTORY_CALLBACK_AUDIENCE ||
        url.username ||
        url.password
      )
        throw new Error();
    } catch {
      issues.push(
        "FACTORY_CALLBACK_AUDIENCE must be an HTTPS origin without a path or credentials",
      );
    }
  }
  const slackNames = [
    "SLACK_BOT_TOKEN",
    "SLACK_SIGNING_SECRET",
    "SLACK_OWNER_CHANNEL",
    "SLACK_OWNER_USER_ID",
  ] as const;
  if (slack || slackNames.some((n) => config[n])) {
    issues.push(
      ...slackNames.filter((n) => !config[n]).map((n) => `Missing ${n} for interactive Slack`),
    );
    if (config.SLACK_BOT_TOKEN && !config.SLACK_BOT_TOKEN.startsWith("xoxb-"))
      issues.push("SLACK_BOT_TOKEN must be a bot token");
    if (config.SLACK_OWNER_CHANNEL && !/^[CGD][A-Z0-9]{8,}$/i.test(config.SLACK_OWNER_CHANNEL))
      issues.push("SLACK_OWNER_CHANNEL must be a channel ID");
    if (config.SLACK_OWNER_USER_ID && !/^U[A-Z0-9]{8,}$/i.test(config.SLACK_OWNER_USER_ID))
      issues.push("SLACK_OWNER_USER_ID must be a member ID");
  }
  if (config.SLACK_OWNER_WEBHOOK) {
    try {
      const url = new URL(config.SLACK_OWNER_WEBHOOK);
      if (
        url.protocol !== "https:" ||
        url.hostname !== "hooks.slack.com" ||
        !url.pathname.startsWith("/services/")
      )
        throw new Error();
    } catch {
      issues.push("SLACK_OWNER_WEBHOOK must be an HTTPS Slack incoming webhook");
    }
  }
  return issues;
}
export function redact(text: string, config: FactoryConfig) {
  for (const f of FIELDS) {
    const value = config[f.name];
    if (f.secret && value) text = text.replaceAll(value, "[redacted]");
  }
  return text;
}
export function runtimeEntries(config: FactoryConfig) {
  return FIELDS.flatMap((f) => {
    const value = config[f.name];
    return RUNTIME_NAMES.includes(f.name) && value
      ? [{ key: f.name, value, type: f.secret ? "encrypted" : "plain", target: ["production"] }]
      : [];
  });
}
