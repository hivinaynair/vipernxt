import { createHash } from "node:crypto";

export const readinessAreas = [
  "outcome",
  "access",
  "journeys",
  "entities",
  "surfaces",
  "rules",
  "integrations",
  "files",
  "accessibility",
  "data-handling",
  "operations",
  "rollout",
  "model-judgment",
] as const;
export function contentHash(text: string) {
  return createHash("sha256").update(text).digest("hex");
}
type RecordValue = Record<string, unknown>;
function object(value: unknown): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Readiness: expected object");
  return value as RecordValue;
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error("Readiness: nonempty text required");
  return value;
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Readiness: expected array");
  return value;
}
function strings(value: unknown, nonempty = true): string[] {
  const result = list(value).map(text);
  if ((nonempty && !result.length) || new Set(result).size !== result.length)
    throw new Error("Readiness: empty or duplicate references");
  return result;
}
function unique(rows: unknown[]): Map<string, RecordValue> {
  const result = new Map<string, RecordValue>();
  for (const row of rows) {
    const r = object(row),
      id = text(r.id);
    if (result.has(id)) throw new Error(`Readiness: duplicate ID ${id}`);
    result.set(id, r);
  }
  return result;
}
export function readinessPath(value: unknown): string {
  const p = text(value);
  if (
    !/^[A-Za-z0-9_.@/-]+$/.test(p) ||
    p.split("/").some((s) => !s || [".", "..", ".git", ".factory"].includes(s))
  )
    throw new Error("Readiness: unsafe path");
  return p;
}
export type ReadinessContext = {
  file: string;
  packetText: string;
  approval: string;
  scope: "first-slice" | "mvp";
  specFiles: string[];
  files: Record<string, string>;
  state: unknown;
  requirementIds: string[];
  allowSimulation?: boolean;
  staging?: boolean;
  requiredArtifacts?: string[];
  coverageFile?: string;
};
/** Structural gate. Customer validation and semantic completeness remain human responsibilities. */
export function validateReadiness(ctx: ReadinessContext) {
  const p = object(JSON.parse(ctx.packetText));
  if (p.version !== 1 || p.scope !== ctx.scope || p.approval !== ctx.approval)
    throw new Error("Readiness: version, scope or approval differs from batch");
  const pinned = (path: unknown) => {
    const name = readinessPath(path);
    if (!ctx.specFiles.includes(name) || typeof ctx.files[name] !== "string")
      throw new Error(`Readiness: reference must exist and be pinned: ${name}`);
    return name;
  };
  pinned(ctx.file);
  if (ctx.coverageFile && p.coverageFile !== ctx.coverageFile)
    throw new Error("Readiness: coverage file differs from batch");
  const stateFile = pinned(p.stateFile);
  const artifacts = new Map<string, string>();
  for (const item of list(p.artifacts)) {
    const a = object(item),
      path = pinned(a.path),
      hash = text(a.sha256);
    if (
      artifacts.has(path) ||
      path === ctx.file ||
      path === stateFile ||
      !/^[a-f0-9]{64}$/.test(hash) ||
      contentHash(ctx.files[path]) !== hash
    )
      throw new Error(`Readiness: stale or invalid artifact hash: ${path}`);
    artifacts.set(path, hash);
  }
  if (!artifacts.size) throw new Error("Readiness: contracts required");
  for (const path of ctx.requiredArtifacts ?? [])
    if (!artifacts.has(path))
      throw new Error(`Readiness: authoritative artifact must be hash-bound: ${path}`);
  const refs = (value: unknown) => {
    const rows = list(value);
    if (!rows.length) throw new Error("Readiness: contract references required");
    for (const item of rows) {
      const r = object(item),
        path = pinned(r.path),
        locator = text(r.locator);
      if (!artifacts.has(path) || !ctx.files[path].includes(locator))
        throw new Error(`Readiness: missing contract section: ${path} ${locator}`);
    }
  };
  const areas = unique(list(p.areas));
  if (areas.size !== readinessAreas.length || readinessAreas.some((id) => !areas.has(id)))
    throw new Error("Readiness: all thirteen applicability areas required");
  for (const a of areas.values()) {
    if (a.applies === true) refs(a.refs);
    else if (a.applies === false) text(a.reason);
    else throw new Error("Readiness: explicit applicability required");
  }
  const requirements = unique(list(p.requirements)),
    cases = unique(list(p.cases));
  if (
    JSON.stringify([...requirements.keys()].sort()) !==
    JSON.stringify([...ctx.requirementIds].sort())
  )
    throw new Error("Readiness: requirements differ from approved coverage");
  for (const [id, r] of requirements) {
    refs(r.refs);
    for (const caseId of strings(r.cases)) {
      const c = cases.get(caseId);
      if (!c || !strings(c.requirements).includes(id))
        throw new Error(`Readiness: broken acceptance trace: ${id} ${caseId}`);
    }
  }
  const kinds = new Set<string>();
  for (const [id, c] of cases) {
    const kind = text(c.kind);
    if (
      ![
        "ordinary",
        "incomplete",
        "exception",
        "boundary",
        "denial",
        "retry",
        "conflict",
        "failure",
      ].includes(kind)
    )
      throw new Error("Readiness: invalid case kind");
    kinds.add(kind);
    for (const field of ["actor", "preconditions", "input", "trigger"]) text(c[field]);
    strings(c.expected);
    for (const requirement of strings(c.requirements)) {
      if (
        !requirements.has(requirement) ||
        !strings(requirements.get(requirement)!.cases).includes(id)
      )
        throw new Error(`Readiness: orphan case ${id}`);
    }
  }
  const walkthrough = object(p.walkthrough);
  text(walkthrough.person);
  text(walkthrough.date);
  text(walkthrough.evidence);
  if (
    walkthrough.provenance !== "observed" &&
    !(ctx.allowSimulation && walkthrough.provenance === "simulation")
  )
    throw new Error(
      "Readiness: customer walkthrough required; synthetic examples cannot approve a live batch",
    );
  const walkedKinds = new Set(
    strings(walkthrough.cases).map((id) => {
      if (!cases.has(id)) throw new Error("Readiness: walkthrough references unknown case");
      return text(cases.get(id)!.kind);
    }),
  );
  for (const kind of ["ordinary", "incomplete", "exception"])
    if (!kinds.has(kind) || !walkedKinds.has(kind))
      throw new Error(`Readiness: ${kind} walkthrough missing`);
  const state = object(ctx.state),
    decisions = unique(list(state.decisions));
  const decision = decisions.get(ctx.approval);
  if (!decision || !text(decision.answer)) throw new Error("Readiness: recorded approval required");
  const binding = object(decision.requirements);
  if (
    binding.file !== ctx.file ||
    binding.sha256 !== contentHash(ctx.packetText) ||
    binding.scope !== ctx.scope
  )
    throw new Error("Readiness: approval does not bind this exact packet");
  const actions = strings(binding.actions);
  if (!actions.includes("build") || (ctx.staging && !actions.includes("staging")))
    throw new Error("Readiness: requested action was not approved");
  const validateAffected = (r: RecordValue) => {
    for (const id of strings(r.requirements))
      if (!requirements.has(id))
        throw new Error("Readiness: finding or assumption outside approved scope");
  };
  for (const f of unique(list(p.findings)).values()) {
    if (f.status === "excluded") {
      if (strings(f.requirements).some((id) => requirements.has(id)))
        throw new Error("Readiness: excluded findings retain in-scope requirements");
    } else validateAffected(f);
    text(f.summary);
    text(f.owner);
    if (
      typeof f.material !== "boolean" ||
      !["open", "resolved", "excluded"].includes(String(f.status))
    )
      throw new Error("Readiness: invalid finding");
    if (f.material && f.status === "open")
      throw new Error("Readiness: unresolved material finding");
    if (f.status !== "open") {
      const resolution = decisions.get(text(f.decision));
      if (!resolution || !text(resolution.answer))
        throw new Error("Readiness: finding resolution needs a recorded decision");
    }
  }
  for (const a of unique(list(p.assumptions)).values()) {
    validateAffected(a);
    text(a.consequence);
    text(a.recheck);
    const accepted = decisions.get(text(a.decision));
    if (!accepted || !text(accepted.answer))
      throw new Error("Readiness: domain assumption was not accepted");
  }
  for (const item of list(state.held ?? [])) {
    const h = object(item);
    if (
      !["answered", "resolved", "closed", "done"].includes(String(h.status)) &&
      h.material !== false &&
      (!Array.isArray(h.requirements) ||
        !h.requirements.length ||
        h.requirements.some((id) => requirements.has(String(id))))
    )
      throw new Error("Readiness: material held item affects this scope");
  }
  return { sha256: contentHash(ctx.packetText), scope: ctx.scope, approval: ctx.approval };
}
