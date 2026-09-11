#!/usr/bin/env bun
/**
 * Renders the pipeline digest from docs/product/state.yaml.
 *
 *   bun scripts/status.ts [--state docs/product/state.yaml]
 *
 * Deterministic on purpose. The digest is a projection of one YAML file, so it
 * should read the same every time rather than being re-improvised per session.
 * The `status` skill prints this and adds nothing.
 *
 * Exit 0 always — "no product here" is an answer, not a failure.
 */

type Held = {
  id?: string;
  kind?: "gather" | "decide";
  phase?: string | number;
  raised?: string;
  what?: string;
  detail?: string;
  status?: "open" | "answered" | "deferred";
  until?: string;
};

type Phase = { name?: string; status?: string; artifact?: string; optional?: boolean };

type State = {
  product?: string;
  phase?: string | number;
  phases?: Record<string, Phase>;
  clone?: { customized?: string };
  held?: Held[];
  ui_writes?: "allow" | "deny";
};

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (process.argv[i + 1] ?? fallback);
};

const statePath = arg("state", "docs/product/state.yaml");

const file = Bun.file(statePath);
if (!(await file.exists())) {
  console.log("No product is being shaped here.");
  process.exit(0);
}

let state: State;
try {
  state = Bun.YAML.parse(await file.text()) as State;
} catch (e) {
  console.log(`Cannot read ${statePath}: ${(e as Error).message}`);
  process.exit(0);
}

const today = new Date();
const days = (iso?: string) => {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((today.getTime() - then.getTime()) / 86_400_000);
};

const age = (iso?: string) => {
  const d = days(iso);
  if (d === null) return "";
  if (d <= 0) return " (today)";
  return d === 1 ? " (1 day)" : ` (${d} days)`;
};

const held = state.held ?? [];
const out: string[] = [];

// Waiting on you — gather before decide, then oldest first.
const open = held
  .filter((h) => h.status === "open")
  .sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "gather" ? -1 : 1;
    return (days(b.raised) ?? 0) - (days(a.raised) ?? 0);
  });

if (open.length > 0) {
  out.push("**Waiting on you**");
  for (const h of open) {
    const where = h.detail ? ` — ${h.detail}` : "";
    out.push(`- ${h.what ?? h.id ?? "(unnamed)"}${age(h.raised)}${where}`);
  }
  out.push("");
}

// Where we are.
const phases = Object.entries(state.phases ?? {});
const done = phases.filter(([, p]) => p.status === "done").map(([, p]) => p.name ?? "");
const now = phases.find(([, p]) => p.status === "in-progress" || p.status === "blocked");
const upcoming = phases.find(([, p]) => p.status === "pending" && !p.optional);

if (phases.length > 0) {
  out.push("**Where we are**");
  const bits: string[] = [];
  if (done.length > 0) bits.push(`done: ${done.join(", ")}`);
  if (now) bits.push(`now: ${now[1].name}${now[1].status === "blocked" ? " (blocked)" : ""}`);
  if (upcoming) bits.push(`next: ${upcoming[1].name}`);
  out.push(bits.join(" · "));
  if (
    state.clone?.customized === "pending" &&
    phases.find(([, p]) => p.name === "shape")?.status === "done"
  ) {
    out.push("`/next` names the clone next.");
  }
  out.push("");
}

// Deferred.
const deferred = held.filter((h) => h.status === "deferred");
if (deferred.length > 0) {
  out.push("**Deferred**");
  for (const h of deferred) out.push(`- ${h.what ?? h.id} — returns ${h.until ?? "(no date)"}`);
  out.push("");
}

// The UI gate, only while it is closed.
const shapeDone = phases.find(([, p]) => p.name === "shape")?.[1]?.status === "done";
const gated = state.ui_writes === "deny" || (state.ui_writes !== "allow" && !shapeDone);
if (gated) {
  out.push("**Do not**");
  out.push(
    "Do not edit `apps/*/src/app` or `apps/*/src/features` until the design doc is approved.",
  );
  out.push("");
}

console.log(out.join("\n").trim());
