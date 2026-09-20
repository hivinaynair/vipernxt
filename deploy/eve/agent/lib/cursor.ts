import { repository, required } from "./config.js";
import type { Attempt } from "./store.js";

export function stationFor(phase: Attempt["phase"]) {
  if (phase === "build") {
    return {
      mode: "agent" as const,
      model: {
        id: "grok-4.6",
        params: [
          { id: "effort", value: "medium" },
          { id: "fast", value: "false" },
        ],
      },
    };
  }
  return {
    // Plan mode answered in prose and failed the JSON contract twice.
    mode: "agent" as const,
    model: { id: "claude-4.6-sonnet-thinking" },
  };
}

type ModelList = { items?: { id: string }[]; models?: string[] };

export async function resolveStation(phase: Attempt["phase"], request: typeof cursor = cursor) {
  const configured = stationFor(phase);
  if (phase === "build") return configured;
  const listed = await request<ModelList>("/models");
  const ids = [...(listed.items ?? []).map((item) => item.id), ...(listed.models ?? [])].filter(
    Boolean,
  );
  const pick =
    ids.find((id) => id === configured.model.id) ??
    ids.find((id) => /claude/i.test(id)) ??
    ids.find((id) => id !== "grok-4.6") ??
    ids[0];
  if (!pick) throw new Error("Cursor has no reviewer model");
  return { mode: "agent" as const, model: { id: pick } };
}
export class CursorError extends Error {
  constructor(
    public status: number,
    detail = "",
  ) {
    super(detail ? `Cursor HTTP ${status}: ${detail}` : `Cursor HTTP ${status}`);
  }
}
export async function cursor<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch(`https://api.cursor.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${required("CURSOR_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) {
    const detail = (await r.text()).replace(/\s+/g, " ").trim().slice(0, 180);
    throw new CursorError(r.status, detail);
  }
  return r.json() as Promise<T>;
}
export type Run = {
  id: string;
  agentId: string;
  status: string;
  result?: string;
  git?: { branches: { repoUrl: string; branch?: string }[] };
};
// Stable identity has already been persisted in the repository checkpoint.
// Ambiguous POST responses are reconciled on the next tick, never replaced
// with a new identity. No long-lived process or model polling loop is needed.
export async function advanceRemote(
  a: Attempt,
  prompt: string,
  request: typeof cursor = cursor,
): Promise<Run | null> {
  let agent: { id: string; latestRunId?: string };
  try {
    agent = await request(`/agents/${a.agentId}`);
  } catch (e) {
    if (!(e instanceof CursorError && e.status === 404) || a.posted) throw e;
    const station = await resolveStation(a.phase, request);
    const created = await request<{ agent: { id: string }; run: Run }>("/agents", "POST", {
      agentId: a.agentId,
      prompt: { text: prompt },
      repos: [{ url: `https://github.com/${repository()}`, startingRef: a.startingRef ?? a.base }],
      model: station.model,
      workOnCurrentBranch: false,
      autoCreatePR: false,
      mode: station.mode,
    });
    if (created.agent.id !== a.agentId || created.run.agentId !== a.agentId)
      throw new Error("Cursor identity mismatch");
    a.runId = created.run.id;
    a.posted = true;
    return null;
  }
  if (agent.id !== a.agentId || !agent.latestRunId || (a.runId && agent.latestRunId !== a.runId))
    throw new Error("Cursor run changed outside factory");
  a.runId = agent.latestRunId;
  a.posted = true;
  const run = await request<Run>(`/agents/${a.agentId}/runs/${a.runId}`);
  if (run.agentId !== a.agentId || run.id !== a.runId)
    throw new Error("Cursor run identity mismatch");
  return run;
}
