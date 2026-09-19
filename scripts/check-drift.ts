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
  size?: string;
  phases?: Record<string, Phase>;
  clone?: { customized?: string; tickets?: string; scaffolded?: string };
  engagement?: { site?: string; baseline?: string };
  eval_set?: string;
  outcome?: { kind?: string; why?: string };
  held?: Held[];
  idea?: string;
  idea_outdated?: boolean;
  reframe?: string;
  clip?: { kind?: string; acceptance?: string; acceptance_decision?: string; evidence?: string };
  decisions?: { id?: string; answer?: string }[];
  surfaces?: string[];
};
type Feature = { id?: string; title?: string; serves?: string[]; linear?: string };
type Step = { id?: string };
type Journey = { id?: string; title?: string; steps?: Step[] };
type Spine = { source?: string; features?: Feature[]; journeys?: Journey[] };

const STATE = "docs/product/state.yaml";
const RECIPE = "docs/kit/recipe.yaml";
const CLIP_KINDS = new Set(["replace", "wrap"]);
const SIZES = new Set(["engagement", "new-product", "new-feature", "small-change"]);
const OUTCOME_KINDS = new Set(["parked", "buy-instead"]);
/** Phases that need a site: there is no homework and no eval set without one. */
const SITE_PHASES = new Set(["field", "shape", "journeys", "build"]);
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
  if (!phase.artifact) {
    findings.push(`phase ${key} (${phase.name}) is done but has no artifact reference`);
    continue;
  }
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

// 5. Idea paragraph superseded by a decision but not rewritten.
if (state.idea_outdated === true) {
  findings.push(
    "idea_outdated is true — rewrite docs/product/state.yaml `idea:` to match closed decisions, then clear the flag",
  );
}

const shapePhase = Object.values(state.phases ?? {}).find((p) => p.name === "shape");

const started = (p?: Phase) => p?.status !== undefined && p.status !== "pending";
const namedPhase = (n: string) => Object.entries(state.phases ?? {}).find(([, p]) => p.name === n);

// 5b. A reframe nobody has written yet. `shape: done` opens the UI gate, so a
// placeholder here is the difference between "they confirmed it" and "we left a
// note to ourselves" — and the gate cannot tell them apart by length alone.
const PLACEHOLDER = /\b(pending|tbd|todo|tba|xxx|fixme|placeholder)\b/i;
if (shapePhase?.status === "done" && PLACEHOLDER.test(state.reframe ?? "")) {
  findings.push(
    "phase shape is done but `reframe:` still reads as a placeholder — the UI gate opens on this field, so it has to be the paragraph they confirmed",
  );
}

// 5c. Build without the eval set is the documented exit test ("Build may start
// when the eval set exists and wave 0 can seed it") — it was never enforced, so
// a slice could be built with nothing to score it against.
const buildPhase = namedPhase("build")?.[1];
if (started(buildPhase)) {
  const path = (state.eval_set ?? "").trim();
  if (!path) {
    findings.push(
      `phase build is ${buildPhase?.status} but no eval_set is named — there is nothing to score the slice against`,
    );
  } else if (!existsSync(path)) {
    findings.push(
      `phase build is ${buildPhase?.status} but eval_set ${path} does not exist — wave 0 cannot seed it`,
    );
  }
  if (!existsSync("docs/journeys")) {
    findings.push(
      "phase build is in progress but there is no docs/journeys spine — a slice with no step to cite is the thing the spine exists to prevent",
    );
  }
  if (!(state.engagement?.baseline ?? "").trim() || state.engagement?.baseline === "unknown") {
    findings.push(
      "phase build is in progress but engagement.baseline is unknown — the checkpoint scores the clip against a before-number, and some baselines expire when the site changes system",
    );
  }
}

// Research and field may overlap; structure belongs before product implementation.
const CHAIN = [
  "salvage",
  "research",
  "field",
  "shape",
  "ontology",
  "journeys",
  "structure",
  "build",
];
for (const [key, phase] of Object.entries(state.phases ?? {})) {
  const at = CHAIN.indexOf(phase.name ?? "");
  if (at < 1 || !started(phase) || phase.optional) continue;
  for (const [earlierKey, earlier] of Object.entries(state.phases ?? {})) {
    const earlierAt = CHAIN.indexOf(earlier.name ?? "");
    if (earlierAt < 0 || earlierAt >= at || earlier.optional) continue;
    if (phase.name === "field" && earlier.name === "research") continue;
    if (
      phase.name === "shape" &&
      phase.status !== "done" &&
      ["research", "field"].includes(earlier.name ?? "")
    )
      continue;
    const needsCompletion =
      phase.status === "done" ||
      ["ontology", "journeys", "structure", "build"].includes(phase.name ?? "");
    if (earlier.status === "pending" || (needsCompletion && earlier.status !== "done")) {
      findings.push(
        `phase ${key} (${phase.name}) is ${phase.status} but earlier phase ${earlierKey} (${earlier.name}) is still ${earlier.status}`,
      );
    }
  }
}

// 5a. Sizing. A design doc written against nobody is the failure the whole loop
// exists to prevent, so this is a hard drift.
if (state.size !== undefined && !SIZES.has(state.size)) {
  findings.push(`size is "${state.size}" — use ${[...SIZES].join(", ")}`);
}
// The entry condition, enforced directly rather than through a mode: somebody
// named told you they have a problem. Without a site there is no homework, no
// last-ten-cases and therefore no eval set, so there is nothing to score a slice
// against — every phase below depends on one existing.
if (shapePhase?.status === "done" && !(state.engagement?.site ?? "").trim()) {
  findings.push(
    "phase shape is done but no engagement.site is named — a design doc confirmed by nobody is not confirmed",
  );
}
if (!(state.engagement?.site ?? "").trim()) {
  for (const [key, phase] of Object.entries(state.phases ?? {})) {
    if (!SITE_PHASES.has(phase.name ?? "")) continue;
    if (phase.status && phase.status !== "pending") {
      findings.push(
        `phase ${key} (${phase.name}) is ${phase.status} but no engagement.site is named — no customer means no eval set, so there is nothing to score a slice against`,
      );
    }
  }
}

if (state.outcome && !OUTCOME_KINDS.has(state.outcome.kind ?? "")) {
  findings.push(
    `outcome.kind is "${state.outcome.kind ?? ""}" — use ${[...OUTCOME_KINDS].join(" or ")}`,
  );
}
if (state.outcome && !(state.outcome.why ?? "").trim()) {
  findings.push("outcome is set with no `why` — a stopped engagement must say why it stopped");
}

// 5b. Shape done without a confirmed reframe.
if (shapePhase?.status === "done") {
  const reframe = (state.reframe ?? "").trim();
  if (!reframe) {
    findings.push("phase shape is done but `reframe` is empty — U5 is the exit test");
  }
}

if (state.clip?.acceptance === "accepted") {
  const decision = state.decisions?.find(
    (d) => d.id === state.clip?.acceptance_decision && d.answer?.trim(),
  );
  if (!decision) findings.push("clip is accepted but has no recorded acceptance decision");
  if (!state.clip.evidence || !existsSync(state.clip.evidence))
    findings.push("clip is accepted but its evidence artifact is missing");
}

// 5c. Clip kind and surfaces against the kit recipe.
if (state.clip?.kind && !CLIP_KINDS.has(state.clip.kind)) {
  findings.push(`clip.kind is ${state.clip.kind} — use replace or wrap`);
}
if (state.clone?.scaffolded === "done" && (!state.surfaces || state.surfaces.length === 0)) {
  findings.push("clone.scaffolded is done but surfaces is empty");
}
if (existsSync(RECIPE) && state.surfaces && state.surfaces.length > 0) {
  try {
    const recipe = Bun.YAML.parse(readFileSync(RECIPE, "utf8")) as {
      surfaces?: Record<string, unknown>;
    };
    const known = new Set(Object.keys(recipe.surfaces ?? {}));
    for (const s of state.surfaces) {
      if (!known.has(s)) {
        findings.push(`surfaces includes ${s} which is not in ${RECIPE}`);
      }
    }
  } catch {
    // malformed recipe is scaffold's job
  }
}

const SCAFFOLDED = "docs/kit/scaffolded.yaml";
if (state.clone?.scaffolded === "done" && !existsSync(SCAFFOLDED))
  findings.push(`clone.scaffolded is done but ${SCAFFOLDED} does not exist`);
if (state.clone?.scaffolded === "done" && existsSync(SCAFFOLDED)) {
  try {
    const scaffolded = Bun.YAML.parse(readFileSync(SCAFFOLDED, "utf8")) as {
      surfaces?: string[];
      status?: string;
    };
    if (scaffolded.status !== "verified")
      findings.push(`clone.scaffolded is done but ${SCAFFOLDED} is not verified`);
    const have = new Set(scaffolded.surfaces ?? []);
    for (const s of state.surfaces ?? []) {
      if (!have.has(s)) {
        findings.push(`state.surfaces includes ${s} which is not in ${SCAFFOLDED}`);
      }
    }
  } catch {
    findings.push(`${SCAFFOLDED} cannot be parsed`);
  }
}

// 6. Each spine against the design doc it claims to view, and its features.
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

  // A clip that pivots leaves the eval set measuring the product it used to be.
  // Every gate still reports green, and the checkpoint shows them a score for
  // something nobody built. fde-loop F already says a slice must "say which eval
  // cases it covers"; this is that rule, enforced.
  if (started(buildPhase)) {
    const cited = new Set<string>();
    for (const file of new Bun.Glob("{apps,packages,e2e}/**/*.eval.ts").scanSync(".")) {
      for (const m of readFileSync(file, "utf8").matchAll(/\bJ\d+\.S\d+[a-z]?\b/g)) {
        cited.add(m[0]);
      }
    }
    for (const j of spine.journeys ?? []) {
      const steps = (j.steps ?? []).map((st) => st.id).filter(Boolean) as string[];
      if (steps.length === 0 || steps.some((id) => cited.has(id))) continue;
      findings.push(
        `${path}: journey ${j.id} (${j.title}) is on the spine but no eval case cites any of its steps — the score measures a different clip`,
      );
    }
  }

  const features = spine.features ?? [];
  const linearPhase = Object.values(state.phases ?? {}).find((p) => p.name === "build");
  for (const f of features) {
    if (!f.serves || f.serves.length === 0) {
      findings.push(`${path}: feature ${f.id} serves no steps`);
    }
    if (
      linearPhase?.status === "in-progress" &&
      state.clone?.tickets !== "deferred" &&
      state.clone?.tickets !== "pending" &&
      !f.linear
    ) {
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
