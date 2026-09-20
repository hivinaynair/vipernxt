import { intake } from "./contract.js";
import { runDeadline } from "./deployment.js";
import { github, type Issue } from "./github.js";
import { slackOwnerUserId } from "./pager.js";
import { archiveBatch, readState, type State, saveState } from "./store.js";

export const OWNER_COMMANDS = ["hold", "retry", "reject"] as const;
export type OwnerCommand = (typeof OWNER_COMMANDS)[number];

export const OWNER_RETRY_PROMPT =
  "Always call start_batch now, even if a batch is already running. The tool adopts the same issue and intake; skipping it leaves the old workflow in place. This is an owner Retry from Slack for the existing approved contract. Do not change scope, reset budgets, or invent the manifest. If the batch cannot resume, explain the exact error and stop.";

export type OwnerCommandResult =
  | { status: "held" }
  | { status: "rejected" }
  | { status: "retry_dispatch"; issue: number }
  | { status: "cannot_retry"; reason: string }
  | { status: "ignored"; reason: string };

export function parseOwnerCommand(value: string): OwnerCommand | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized === "hold" || normalized === "retry" || normalized === "reject") return normalized;
}

export function looksLikeSecret(text: string) {
  return /xox[baprs]-|ghp_|github_pat_|sk_live|sk_test|-----BEGIN /i.test(text);
}

export function actorAllowed(userId: string | undefined, allowed = slackOwnerUserId()) {
  return Boolean(userId && allowed && userId === allowed);
}

export async function applyOwnerCommand(
  command: OwnerCommand,
  issue: number,
  deps: {
    readState?: typeof readState;
    saveState?: typeof saveState;
    github?: typeof github;
    now?: number;
  } = {},
): Promise<OwnerCommandResult> {
  const read = deps.readState ?? readState;
  const save = deps.saveState ?? saveState;
  const gh = deps.github ?? github;
  const now = deps.now ?? Date.now();
  const comment = async (body: string) => {
    try {
      await gh(`/issues/${issue}/comments`, "POST", { body });
    } catch {
      /* Evidence comments are the operator projection. */
    }
  };
  if (command === "hold") {
    await comment("**Owner held from Slack.** Eve stays stopped.");
    return { status: "held" };
  }
  const { state, sha } = await read();
  if (command === "reject") {
    archiveBatch(state, "Owner rejected from Slack");
    state.ownerPing = {
      ...(state.ownerPing ?? { key: `${issue}:`, issue }),
      issue,
      command: "reject",
    };
    await save(state, sha);
    await comment("**Owner rejected from Slack.** Batch archived. Eve will not resume.");
    try {
      await gh(`/issues/${issue}/labels/factory`, "DELETE");
    } catch {
      /* Label removal is best-effort; archive is the hold. */
    }
    return { status: "rejected" };
  }
  const batch = state.batch;
  if (!batch || batch.issue !== issue)
    return { status: "cannot_retry", reason: "No batch is waiting on this issue." };
  if (batch.status === "running") return { status: "ignored", reason: "Batch is already running." };
  if (batch.status !== "blocked" && batch.status !== "paused")
    return { status: "cannot_retry", reason: `Batch is ${batch.status}, not waiting.` };
  let scopeValid = false;
  try {
    const current = await gh<Issue>(`/issues/${issue}`);
    const contract = intake(current.body ?? "");
    scopeValid =
      current.state === "open" &&
      current.labels.some((l) => l.name === "factory") &&
      contract.commit === batch.commit &&
      contract.manifest === batch.manifestPath;
  } catch {
    /* Missing evidence is a hold, never permission. */
  }
  if (!scopeValid)
    return {
      status: "cannot_retry",
      reason: "Issue is closed, unlabeled, or the approved contract changed.",
    };
  if (now >= runDeadline(batch))
    return { status: "cannot_retry", reason: "Original batch time budget is exhausted." };
  state.ownerPing = { ...(state.ownerPing ?? { key: `${issue}:`, issue }), command: "retry" };
  await save(state, sha);
  await comment(
    "**Owner retry from Slack.** Same approved contract. Eve may resume inside existing limits.",
  );
  return { status: "retry_dispatch", issue };
}

export async function postSlackEvidence(
  issue: number,
  text: string,
  request: typeof github = github,
) {
  if (looksLikeSecret(text)) return { status: "secret" as const };
  const body = text.trim().slice(0, 4000);
  if (!body) return { status: "empty" as const };
  await request(`/issues/${issue}/comments`, "POST", {
    body: `**Owner from Slack**\n\n${body}\n\n<!-- factory-slack-evidence -->`,
  });
  return { status: "posted" as const };
}

export function issueFromPing(state: State, channel?: string, threadTs?: string) {
  const ping = state.ownerPing;
  if (!ping || !threadTs) return;
  if (ping.ts && ping.ts !== threadTs) return;
  if (channel && ping.channel && ping.channel !== channel) return;
  return ping.issue;
}
