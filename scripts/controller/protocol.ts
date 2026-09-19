import { createHmac, timingSafeEqual } from "node:crypto";
export const commands = ["build", "status", "pause", "resume", "cancel", "retry"] as const;
export type Action = (typeof commands)[number];
export function parseCommand(text: string, mentionUrl?: string): Action | undefined {
  if (mentionUrl) {
    const escaped = mentionUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.trim().replace(new RegExp(`^(?:\\[[^\\]]*\\]\\(${escaped}\\)|${escaped})\\s*`), "");
  }
  // Exact grammar: never interpret ticket prose, quoted text, or shell fragments.
  const value = text
    .trim()
    .replace(/^@vipernxt\b\s*/i, "")
    .trim()
    .toLowerCase();
  if (!value) return "status";
  return commands.find((command) => command === value);
}
export function equalSecret(actual: string, expected: string) {
  const a = Buffer.from(actual),
    b = Buffer.from(expected);
  return b.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}
export function verifyWebhook(raw: string, signature: string, secret: string, now = Date.now()) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const digest = createHmac("sha256", secret).update(raw).digest("hex");
  if (!equalSecret(signature.toLowerCase(), digest)) return false;
  try {
    const { webhookTimestamp } = JSON.parse(raw);
    return Number.isFinite(webhookTimestamp) && Math.abs(now - webhookTimestamp) < 60_000;
  } catch {
    return false;
  }
}
export type AgentEvent = {
  type: string;
  action: string;
  organizationId: string;
  oauthClientId: string;
  appUserId: string;
  webhookTimestamp: number;
  agentSession: {
    id: string;
    issueId?: string;
    issue?: { id: string };
    creatorId?: string;
    comment?: { body: string };
    sourceCommentId?: string;
  };
  agentActivity?: {
    id: string;
    userId: string;
    content?: { body?: string };
    body?: string;
    signal?: string;
  };
};
export function eventCommand(event: AgentEvent, comment?: string, mentionUrl?: string) {
  let body =
    event.action === "prompted"
      ? (event.agentActivity?.content?.body ?? event.agentActivity?.body ?? "")
      : (comment ?? event.agentSession.comment?.body ?? "");
  // Linear emits app mentions as user tags. Strip only this installation's identity.
  if (/^[a-f0-9-]{36}$/i.test(event.appUserId)) {
    const mention = new RegExp(
      `^\\s*<user id="${event.appUserId}"(?: notify)?>([^<>]*)<\\/user>\\s*`,
      "i",
    );
    body = body.replace(mention, "");
  }
  // Delegation creates a service thread, not an instruction to build.
  if (
    event.action === "created" &&
    !comment &&
    body === "This thread is for an agent session with vipernxt."
  )
    return "status";
  return parseCommand(body, mentionUrl);
}
