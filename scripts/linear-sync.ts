#!/usr/bin/env bun
/**
 * Turns the journey spine into a Linear sync plan, and records issue ids back.
 *
 *   bun scripts/linear-sync.ts plan   docs/journeys/<name>.yaml
 *   bun scripts/linear-sync.ts record docs/journeys/<name>.yaml F2 KUB-42
 *
 * The agent executes the plan through Linear's MCP. This script owns every
 * decision — what the issue says, whether it is a create or an update, what has
 * drifted — because those are the parts prose gets wrong. Issue bodies come out
 * byte-identical every run, so an update is a no-op unless the spine changed.
 *
 * No API key. The MCP is already authenticated and already reaches Linear from
 * both local and cloud sessions; adding a second credential to leak buys nothing
 * until something without an MCP (CI) needs to do this.
 *
 * Exit 1 if the spine cannot be read, or on `record` when the feature is absent.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";

type Step = { id?: string; title?: string; criteria?: string[] };
type Journey = { id?: string; steps?: Step[] };
type Feature = { id?: string; title?: string; serves?: string[]; linear?: string };
type Spine = { product?: string; source?: string; journeys?: Journey[]; features?: Feature[] };

const [cmd, file, ...rest] = process.argv.slice(2);

if (!cmd || !file) {
  console.error("usage: linear-sync.ts <plan|record> <spine.yaml> [<feature-id> <issue-id>]");
  process.exit(1);
}

if (!existsSync(file)) {
  console.error(`no such spine: ${file}`);
  process.exit(1);
}

const raw = readFileSync(file, "utf8");
let spine: Spine;
try {
  spine = Bun.YAML.parse(raw) as Spine;
} catch (e) {
  console.error(`could not parse ${file}: ${(e as Error).message}`);
  process.exit(1);
}

const steps = new Map<string, Step>();
for (const j of spine.journeys ?? []) {
  for (const s of j.steps ?? []) if (s.id) steps.set(s.id, s);
}

function teamKey(): string | null {
  if (!existsSync(".env.playbook")) return null;
  const line = readFileSync(".env.playbook", "utf8")
    .split("\n")
    .find((l) => l.startsWith("LINEAR_TEAM="));
  return line ? line.slice("LINEAR_TEAM=".length).trim() : null;
}

/** The issue body. Deterministic, so re-running produces no diff. */
function body(f: Feature): string {
  const out: string[] = [];
  out.push(`Spine: \`${file}\``);
  if (spine.source) out.push(`Design doc: \`${spine.source}\``);
  out.push(`Module: \`apps/web/src/features/${slug(f.title ?? f.id ?? "")}/\``);
  out.push("");
  out.push(`Serves: ${(f.serves ?? []).join(", ")}`);
  out.push("");
  out.push("## Acceptance criteria");
  out.push("");
  for (const id of f.serves ?? []) {
    const step = steps.get(id);
    if (!step) {
      out.push(`- **${id}** — not found in the spine`);
      continue;
    }
    out.push(`**${id} — ${step.title ?? ""}**`);
    for (const c of step.criteria ?? []) out.push(`- ${c}`);
    if (!step.criteria?.length) out.push("- (no criteria on this step)");
    out.push("");
  }
  out.push("Criteria are copied from the spine. Change them there, not here.");
  return out.join("\n").trim();
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

if (cmd === "plan") {
  const team = teamKey();
  const features = spine.features ?? [];
  const creates = features.filter((f) => !f.linear);
  const updates = features.filter((f) => f.linear);

  console.log(`# Linear plan — ${spine.product ?? "(unnamed product)"}`);
  console.log();
  console.log(
    team
      ? `Team: \`${team}\``
      : "Team: **not recorded**. Ask for the key; it goes in `.env.playbook` as `LINEAR_TEAM`.",
  );
  console.log();
  console.log(`${creates.length} to create, ${updates.length} to update.`);
  console.log();

  for (const f of features) {
    const action = f.linear ? `UPDATE ${f.linear}` : "CREATE";
    console.log(`## ${action} — ${f.id} · ${f.title ?? ""}`);
    console.log();
    console.log(`Title: \`${f.id} · ${f.title ?? ""}\``);
    console.log(`Labels: ${(f.serves ?? []).join(", ") || "(none)"}`);
    console.log();
    console.log("```");
    console.log(body(f));
    console.log("```");
    console.log();
    if (!f.linear) {
      console.log(
        `After creating, record it: \`bun scripts/linear-sync.ts record ${file} ${f.id} <ISSUE-ID>\``,
      );
      console.log();
    }
  }

  // Drift the script can see without touching Linear.
  const missing = (spine.features ?? []).flatMap((f) =>
    (f.serves ?? [])
      .filter((id) => !steps.has(id))
      .map((id) => `${f.id} serves ${id}, which is not in the spine`),
  );
  if (missing.length > 0) {
    console.log("## Drift");
    console.log();
    for (const m of missing) console.log(`- ${m}`);
    console.log();
  }

  console.log("Never touch an issue's state, assignee, cycle or estimate.");
  process.exit(0);
}

if (cmd === "record") {
  const [featureId, issueId] = rest;
  if (!featureId || !issueId) {
    console.error("usage: linear-sync.ts record <spine.yaml> <feature-id> <issue-id>");
    process.exit(1);
  }

  const lines = raw.split("\n");
  // Find `- id: F2` inside features:, then set `linear:` in that block.
  let inFeatures = false;
  let start = -1;
  let indent = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^features:\s*$/.test(line)) {
      inFeatures = true;
      continue;
    }
    if (inFeatures && /^\S/.test(line)) break; // left the features block
    if (!inFeatures) continue;
    const m = line.match(/^(\s*)-\s+id:\s*(\S+)\s*$/);
    if (m && m[2] === featureId) {
      start = i;
      indent = `${m[1]}  `;
      break;
    }
  }

  if (start === -1) {
    console.error(`feature ${featureId} not found under features: in ${file}`);
    process.exit(1);
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*-\s+id:/.test(lines[i] ?? "") || /^\S/.test(lines[i] ?? "")) {
      end = i;
      break;
    }
  }

  const existing = lines.slice(start, end).findIndex((l) => /^\s*linear:/.test(l));
  if (existing !== -1) {
    lines[start + existing] = `${indent}linear: ${issueId}`;
  } else {
    let last = end - 1;
    while (last > start && (lines[last] ?? "").trim() === "") last--;
    lines.splice(last + 1, 0, `${indent}linear: ${issueId}`);
  }

  writeFileSync(file, lines.join("\n"));
  console.log(`recorded ${featureId} -> ${issueId} in ${file}`);
  process.exit(0);
}

console.error(`unknown command: ${cmd}`);
process.exit(1);
