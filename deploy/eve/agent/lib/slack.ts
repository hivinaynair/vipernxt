import {
  actorAllowed,
  applyOwnerCommand,
  issueFromPing,
  looksLikeSecret,
  type OwnerCommand,
  parseOwnerCommand,
  postSlackEvidence,
} from "./owner-command.js";
import { slackOwnerUserId, verifySlackRequest } from "./pager.js";
import { readState } from "./store.js";
import { stampAutonomous } from "./trust.js";

type SlackAction = { action_id?: string; value?: string };
type SlackPayload = {
  type?: string;
  challenge?: string;
  user?: { id?: string };
  channel?: { id?: string };
  message?: { ts?: string };
  response_url?: string;
  actions?: SlackAction[];
  event?: {
    type?: string;
    subtype?: string;
    bot_id?: string;
    user?: string;
    text?: string;
    channel?: string;
    ts?: string;
    thread_ts?: string;
  };
};

export function parseSlackBody(contentType: string | null, raw: string): SlackPayload | undefined {
  if (contentType?.includes("application/x-www-form-urlencoded")) {
    const payload = new URLSearchParams(raw).get("payload");
    if (!payload) return;
    return JSON.parse(payload) as SlackPayload;
  }
  return JSON.parse(raw) as SlackPayload;
}

export function commandFromAction(action: SlackAction | undefined): OwnerCommand | undefined {
  if (action?.action_id === "factory_hold") return "hold";
  if (action?.action_id === "factory_retry") return "retry";
  if (action?.action_id === "factory_reject") return "reject";
  if (action?.value) return parseOwnerCommand(action.value);
}

export function slackOwnerAuth(issue: number, userId: string) {
  return stampAutonomous(
    {
      authenticator: "slack",
      principalType: "user",
      principalId: `slack:${userId}`,
      attributes: {},
    },
    issue,
  );
}

async function ackSlack(url: string | undefined, text: string, replace = true) {
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replace_original: replace, text }),
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });
  } catch {
    /* Button ack is best-effort. */
  }
}

export async function handleSlackCallback(
  request: Request,
  deps: {
    verify?: typeof verifySlackRequest;
    apply?: typeof applyOwnerCommand;
    evidence?: typeof postSlackEvidence;
    readState?: typeof readState;
    dispatchRetry?: (issue: number, userId: string) => Promise<void>;
    now?: number;
  } = {},
): Promise<Response> {
  const raw = await request.text();
  if (raw.length > 32768) return new Response(null, { status: 413 });
  const verify = deps.verify ?? verifySlackRequest;
  if (
    !verify(
      raw,
      request.headers.get("x-slack-request-timestamp"),
      request.headers.get("x-slack-signature"),
      undefined,
      deps.now,
    )
  )
    return new Response(null, { status: 401 });
  let payload: SlackPayload;
  try {
    payload = parseSlackBody(request.headers.get("content-type"), raw) ?? {};
  } catch {
    return new Response(null, { status: 400 });
  }
  if (payload.type === "url_verification" && payload.challenge)
    return Response.json({ challenge: payload.challenge });
  const userId = payload.user?.id ?? payload.event?.user;
  if (!actorAllowed(userId, slackOwnerUserId())) return new Response(null, { status: 204 });
  const apply = deps.apply ?? applyOwnerCommand;
  if (payload.type === "block_actions") {
    const command = commandFromAction(payload.actions?.[0]);
    const issue = Number(payload.actions?.[0]?.value);
    if (!command || !Number.isSafeInteger(issue) || issue < 1)
      return new Response(null, { status: 204 });
    const result = await apply(command, issue);
    const text =
      result.status === "held"
        ? "Holding. Eve stays stopped."
        : result.status === "rejected"
          ? "Rejected. Batch archived."
          : result.status === "retry_dispatch"
            ? "Retry dispatched for the same approved contract."
            : result.status === "cannot_retry"
              ? `Cannot retry: ${result.reason}`
              : result.reason;
    await ackSlack(payload.response_url, text);
    if (result.status === "retry_dispatch" && userId && deps.dispatchRetry)
      await deps.dispatchRetry(issue, userId);
    return new Response(null, { status: 204 });
  }
  const event = payload.event;
  if (
    payload.type === "event_callback" &&
    event?.type === "message" &&
    !event.bot_id &&
    !event.subtype
  ) {
    const thread = event.thread_ts;
    if (!thread || event.ts === thread) return new Response(null, { status: 204 });
    const command = parseOwnerCommand(event.text ?? "");
    const { state } = await (deps.readState ?? readState)();
    const issue = issueFromPing(state, event.channel, thread);
    if (!issue) return new Response(null, { status: 204 });
    if (command) {
      const result = await apply(command, issue);
      if (result.status === "retry_dispatch" && userId && deps.dispatchRetry)
        await deps.dispatchRetry(issue, userId);
      return new Response(null, { status: 204 });
    }
    const evidence = deps.evidence ?? postSlackEvidence;
    if (looksLikeSecret(event.text ?? "")) return new Response(null, { status: 204 });
    try {
      await evidence(issue, event.text ?? "");
    } catch {
      /* Evidence is optional. */
    }
  }
  return new Response(null, { status: 204 });
}
