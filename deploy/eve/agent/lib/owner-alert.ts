import { runDeadline } from "./deployment.js";
import type { Receipt } from "./receipt.js";
import type { State } from "./store.js";

export type OwnerAlert = {
  at: number;
  task: string;
  status: string;
  failure: string;
  tried: string[];
  needed: string;
  retryAllowed: boolean;
  rejectAllowed: boolean;
  pr?: string;
};

export function safeAlertText(value: string, limit = 1500) {
  let text = value;
  for (const name of [
    "CURSOR_API_KEY",
    "VERCEL_TOKEN",
    "AI_GATEWAY_API_KEY",
    "GH_TOKEN",
    "SLACK_BOT_TOKEN",
    "SLACK_SIGNING_SECRET",
    "SLACK_OWNER_WEBHOOK",
  ]) {
    const secret = process.env[name];
    if (secret) text = text.replaceAll(secret, "[redacted]");
  }
  return text
    .replace(/(?:xox[baprs]-|ghp_|github_pat_|vck_|sk_live_|sk_test_)[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/Bearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .slice(0, limit);
}

export function ownerAlert(receipt: Receipt, state: State, now = Date.now()): OwnerAlert {
  const b = state.batch?.issue === receipt.issue ? state.batch : undefined;
  const job =
    b?.manifest.jobs.find((j) => j.id === b.failure?.jobId) ??
    b?.manifest.jobs.find((j) => !b.accepted.includes(j.id));
  const code = b?.failure?.code ?? (b ? "unknown" : "registration_failed");
  const expired = Boolean(
    b &&
      (now >= runDeadline(b) ||
        (b.active && now >= b.active.startedAt + b.manifest.limits.jobSeconds * 1000)),
  );
  const exhausted = expired || code === "attempts_exhausted" || code === "deadline_expired";
  const tried: string[] = [];
  if (b) {
    if (job && b.attempts[job.id])
      tried.push(`${b.attempts[job.id]} builder attempt(s) for ${job.id}.`);
    const reads = Object.values(b.networkRetries ?? {}).reduce((a, n) => a + n, 0);
    const recoveries = Object.values(b.recoveryAttempts ?? {}).reduce((a, n) => a + n, 0);
    if (reads) tried.push(`${reads} bounded transport retry/retries.`);
    if (recoveries) tried.push(`${recoveries} verified recovery continuation(s).`);
    if (b.triage)
      tried.push(`Diagnosis: ${b.triage.result.status}; ${b.triage.result.recommendation}.`);
    tried.push(
      ...(b.triage?.investigation?.facts ?? []).slice(0, 2).map((f) => safeAlertText(f, 300)),
    );
  }
  if (!tried.length)
    tried.push(
      b
        ? "No automatic recovery is recorded for this failure."
        : "Intake validation stopped before implementation started.",
    );
  if (!b && receipt.recommendation)
    tried.push(
      `Failure routing: ${safeAlertText(receipt.recommendation, 80)}; owner attention required.`,
    );
  const needed = !b
    ? "Correct the intake or missing configuration, then authorize intake again on the issue. No batch exists to retry."
    : exhausted
      ? "Decide whether to authorize a new batch. Retry cannot extend expired clocks or exhausted limits."
      : code === "permission_denied"
        ? "Restore provider access securely, then Retry if the original limits still allow it. Do not send credentials in Slack."
        : b.status === "paused" || code === "scope_invalid"
          ? "Confirm the approved scope and issue authorization. Changed requirements need a new approval; Retry cannot expand scope."
          : code === "policy_required" || code === "review_rejected"
            ? "Review the linked findings and resolve the missing decision or rejected checks. Retry keeps the same approval and limits."
            : b.triage?.result.status === "unavailable"
              ? "Inspect the linked diagnostic failure and restore the required service, or choose Hold. Retry stays within the original limits."
              : "Inspect the linked failure and choose Hold, Retry within the existing approval and limits, or Reject this batch.";
  return {
    at: now,
    task: safeAlertText(
      b?.active?.phase && b.active.phase !== "build"
        ? `${b.active.phase}${job ? `: ${job.title}` : ""}`
        : (job?.title ?? "Batch intake"),
    ),
    status: b
      ? "Work is paused; Eve needs your attention."
      : "No implementation started; intake is held.",
    failure: safeAlertText(
      receipt.error ?? b?.error ?? "Eve could not establish a safe next action.",
    ),
    tried,
    needed,
    retryAllowed: Boolean(
      b &&
        ["blocked", "paused"].includes(b.status) &&
        !exhausted &&
        (job === undefined ||
          (b.attempts[job.id] ?? 0) < b.manifest.limits.attempts ||
          Boolean(b.active)),
    ),
    rejectAllowed: Boolean(b && ["blocked", "paused"].includes(b.status)),
    pr: b?.pr,
  };
}
