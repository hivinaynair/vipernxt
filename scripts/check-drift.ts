#!/usr/bin/env bun
/**
 * Reports contradictions between the pipeline artifacts. Reports only — fixing
 * one silently is how a wrongly-closed decision disappears from review.
 *
 *   bun scripts/check-drift.ts
 *
 * Checks what spans two artifacts. Everything internal to a spine is
 * journey.ts's job; this does not duplicate it.
 *
 * Exit 1 when drift is found, 0 when clean or when there is no product yet.
 */

import { existsSync, readFileSync } from "node:fs";

type Phase = { name?: string; status?: string; artifact?: string };
type Held = {
  id?: string;
  what?: string;
  phase?: string | number;
  status?: string;
  until?: string;
};
type State = {
  phases?: Record<string, Phase>;
  clone?: { customized?: string };
  held?: Held[];
};
type Feature = { id?: string; title?: string; serves?: string[]; linear?: string };
type Spine = { source?: string; features?: Feature[] };

const STATE = "docs/product/state.yaml";
const findings: string[] = [];

if (!existsSync(STATE)) {
  console.log("ok: no product state — nothing to compare.");
  process.exit(0);
}

let state: State;
try {
  state = Bun.YAML.parse(readFileSync(STATE, "utf8")) as State;
} catch (e) {
  console.error(`could not parse ${STATE}: ${(e as Error).message}`);
  process.exit(1);
}

// 1. A phase claiming done must have produced its artifact.
for (const [key, phase] of Object.entries(state.phases ?? {})) {
  if (phase.status !== "done") continue;
  if (!phase.artifact) continue;
  if (!existsSync(phase.artifact)) {
    findings.push(`phase ${key} (${phase.name}) is done but ${phase.artifact} does not exist`);
  }
}

// 2. An open item under a phase already marked done.
for (const h of state.held ?? []) {
  if (h.status !== "open" || h.phase === undefined) continue;
  const phase = state.phases?.[String(h.phase)];
  if (phase?.status === "done") {
    findings.push(
      `${h.id ?? "an item"} is still open but phase ${h.phase} (${phase.name}) is done`,
    );
  }
}

// 3. A deferral whose date has passed is due, not deferred.
const today = new Date().toISOString().slice(0, 10);
for (const h of state.held ?? []) {
  if (h.status === "deferred" && h.until && h.until <= today) {
    findings.push(`${h.id ?? "a deferred item"} was due ${h.until}: ${h.what ?? ""}`.trim());
  }
}

// 4. The clone flag against the actual package name.
if (existsSync("package.json")) {
  const name = JSON.parse(readFileSync("package.json", "utf8")).name;
  if (state.clone?.customized === "done" && name === "vipernxt") {
    findings.push("clone.customized is done but the root package is still named vipernxt");
  }
  if (state.clone?.customized === "pending" && name !== "vipernxt") {
    findings.push(`root package is named ${name} but clone.customized is still pending`);
  }
}

// 5. Each spine against the design doc it claims to view, and its features.
const spines = [...new Bun.Glob("docs/journeys/*.yaml").scanSync(".")];
for (const path of spines) {
  let spine: Spine;
  try {
    spine = Bun.YAML.parse(readFileSync(path, "utf8")) as Spine;
  } catch {
    continue; // journey.ts validate owns malformed spines
  }

  if (spine.source && !existsSync(spine.source)) {
    findings.push(`${path} points at ${spine.source}, which does not exist`);
  }

  const features = spine.features ?? [];
  const linearPhase = Object.values(state.phases ?? {}).find((p) => p.name === "build");
  for (const f of features) {
    if (!f.serves || f.serves.length === 0) {
      findings.push(`${path}: feature ${f.id} serves no steps`);
    }
    if (linearPhase?.status === "in-progress" && !f.linear) {
      findings.push(`${path}: feature ${f.id} has no Linear issue`);
    }
  }
}

if (findings.length === 0) {
  console.log("ok: no drift between state, spine and design doc.");
  process.exit(0);
}

console.log("drift — report these, do not fix them silently:\n");
for (const f of findings) console.log(`- ${f}`);
process.exit(1);
