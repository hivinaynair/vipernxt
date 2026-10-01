import { digest, intake } from "./contract.js";
import { runDeadline } from "./deployment.js";
import { github, type Issue } from "./github.js";
import { safeAlertText } from "./owner-alert.js";
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
  return (
    /xox[baprs]-|ghp_|github_pat_|sk_live|sk_test|vck_|Bearer\s+|-----BEGIN /i.test(text) ||
    safeAlertText(text, text.length) !== text
  );
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
    pingId?: string;
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
  const { state, sha } = await read();
  const batch = state.batch;
  if (deps.pingId && state.ownerPing?.id !== deps.pingId)
    return { status: "ignored", reason: "This notification is no longer current." };
  if ((state.lease?.until ?? 0) > now)
    return {
      status: "ignored",
      reason: "A factory transition is in progress; try again after it finishes.",
    };
  if (state.ownerPing?.issue === issue && state.ownerPing.command === "retry")
    return {
      status: "ignored",
      reason: "Retry was already requested for this notification. Check the issue for progress.",
    };
  if (batch && (batch.issue !== issue || !["blocked", "paused"].includes(batch.status)))
    return { status: "ignored", reason: "This issue has no current held batch." };
  if (!batch && (command !== "hold" || state.lastFailure?.issue !== issue))
    return { status: "ignored", reason: "This issue has no current held batch." };
  if (command === "hold") {
    state.ownerPing = { ...(state.ownerPing ?? { key: `${issue}:`, issue }), command: "hold" };
    await save(state, sha);
    await comment("**Owner held from Slack.** Eve stays stopped.");
    return { status: "held" };
  }
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
      contract.manifest === batch.manifestPath &&
      digest(contract) === batch.intakeHash;
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
  if (batch.active && now >= batch.active.startedAt + batch.manifest.limits.jobSeconds * 1000)
    return { status: "cannot_retry", reason: "Original station time budget is exhausted." };
  const job =
    batch.manifest.jobs.find((j) => j.id === batch.failure?.jobId) ??
    batch.manifest.jobs.find((j) => !batch.accepted.includes(j.id));
  if (
    ["attempts_exhausted", "deadline_expired"].includes(batch.failure?.code ?? "") ||
    (!batch.active && job && (batch.attempts[job.id] ?? 0) >= batch.manifest.limits.attempts)
  )
    return { status: "cannot_retry", reason: "Original attempt budget is exhausted." };
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
  const body = safeAlertText(text.trim(), 4000);
  if (!body) return { status: "empty" as const };
  await request(`/issues/${issue}/comments`, "POST", {
    body: `**Owner from Slack**\n\n${body}\n\n<!-- factory-slack-evidence -->`,
  });
  return { status: "posted" as const };
}

export function issueFromPing(state: State, channel?: string, threadTs?: string) {
  const ping = state.ownerPing;
  if (!ping || !threadTs || !channel || !ping.ts || !ping.channel) return;
  if (ping.ts !== threadTs || ping.channel !== channel) return;
  return ping.issue;
}
