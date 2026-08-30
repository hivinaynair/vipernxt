#!/usr/bin/env bun
/**
 * journey.ts — validate and render a journey spine.
 *
 *   bun journey.ts validate docs/journeys/app.yaml
 *   bun journey.ts render   docs/journeys/app.yaml --out docs/journeys/app.md
 *
 * The spine is the source of truth. The markdown is generated; never hand-edit it.
 */

type Actor = { id: string; name: string; type?: string };
type Screen = { id: string; route?: string; bands?: string[]; states?: string[] };
type Exit = { id: string; title?: string };
export type NextEdge = { to: string; when?: string };
type NextRaw = string | NextEdge;
type Step = {
  id: string;
  title: string;
  screen?: string;
  state?: string;
  sees?: string;
  does?: string;
  next?: NextRaw | NextRaw[];
  uses?: string;
  exit?: string;
  satisfaction?: number;
  criteria?: string[];
};
type Journey = {
  id: string;
  title: string;
  actor?: string;
  goal?: string;
  proves?: string;
  reusable?: boolean;
  entry?: string;
  exits?: Exit[];
  steps: Step[];
};
type Feature = { id: string; title: string; serves?: string[] };
type Spine = {
  product?: string;
  source?: string;
  actors?: Actor[];
  screens?: Screen[];
  journeys?: Journey[];
  features?: Feature[];
};

const STEP_ID = /^J\d+\.S\d+[a-z]?$/;

export function nextEdges(s: Step): NextEdge[] {
  if (s.next == null) return [];
  const list = Array.isArray(s.next) ? s.next : [s.next];
  const out: NextEdge[] = [];
  for (const n of list) {
    if (typeof n === "string") {
      if (n) out.push({ to: n });
      continue;
    }
    if (n && typeof n === "object") out.push({ to: String(n.to ?? ""), when: n.when });
  }
  return out;
}

export function nexts(s: Step): string[] {
  return nextEdges(s).map((e) => e.to);
}

export function validateSpine(spine: Spine): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const err = (m: string) => errors.push(m);
  const warn = (m: string) => warnings.push(m);

  if (!spine.product) err("top level: `product` is required");
  if (!spine.journeys?.length) {
    err("top level: at least one journey is required");
    return { errors, warnings };
  }

  const actorIds = new Set((spine.actors ?? []).map((a) => a.id));
  const screens = new Map((spine.screens ?? []).map((s) => [s.id, s]));
  const journeys = new Map(spine.journeys.map((j) => [j.id, j]));
  const stepIds = new Set<string>();
  const usedScreens = new Set<string>();

  for (const j of spine.journeys) {
    if (!/^J\d+$/.test(j.id)) err(`${j.id}: journey id must look like J1`);
    if (!j.steps?.length) {
      err(`${j.id}: has no steps`);
      continue;
    }
    if (j.actor && !actorIds.has(j.actor)) err(`${j.id}: unknown actor "${j.actor}"`);

    const local = new Set(j.steps.map((s) => s.id));
    const referenced = new Set<string>();
    const exitIds = new Set((j.exits ?? []).map((e) => e.id));
    for (const e of j.exits ?? []) {
      if (!e.id) err(`${j.id}: exit is missing id`);
    }
    if (j.entry && !local.has(j.entry)) err(`${j.id}: entry "${j.entry}" is not a step of ${j.id}`);

    for (const s of j.steps) {
      if (stepIds.has(s.id)) err(`${s.id}: duplicate step id`);
      stepIds.add(s.id);

      if (!s.id.startsWith(`${j.id}.`)) err(`${s.id}: step id must be prefixed with "${j.id}."`);
      if (!STEP_ID.test(s.id)) err(`${s.id}: step id must look like ${j.id}.S1 or ${j.id}.S2b`);
      if (!s.title) err(`${s.id}: missing title`);

      if (s.screen) {
        usedScreens.add(s.screen);
        const sc = screens.get(s.screen);
        if (!sc) err(`${s.id}: unknown screen "${s.screen}"`);
        else if (s.state && sc.states?.length && !sc.states.includes(s.state))
          err(
            `${s.id}: state "${s.state}" is not one of screen ${s.screen}'s states (${sc.states.join(", ")})`,
          );
      } else if (!s.uses) {
        warn(`${s.id}: no screen — journey steps should land somewhere`);
      }

      const edges = nextEdges(s);
      for (const e of edges) {
        if (!e.to) err(`${s.id}: next entry is missing to`);
        else if (e.to === s.id) err(`${s.id}: next points at itself`);
        else if (!local.has(e.to)) err(`${s.id}: next "${e.to}" is not a step of ${j.id}`);
        if (e.to) referenced.add(e.to);
      }

      if (s.uses) {
        const child = journeys.get(s.uses);
        if (!child) err(`${s.id}: uses unknown journey "${s.uses}"`);
        else if (child.id === j.id) err(`${s.id}: uses itself`);
        else {
          if (!child.reusable)
            warn(`${s.id}: uses ${child.id}, which is not marked reusable: true`);
          const childExits = (child.exits ?? []).map((e) => e.id).filter(Boolean);
          if (!edges.length && !s.exit) {
            err(`${s.id}: uses ${child.id} but has no next mapping and no exit`);
          } else if (childExits.length && edges.length) {
            const unlabeled = edges.filter((e) => !e.when);
            if (!(unlabeled.length === 1 && edges.length === 1)) {
              const mapped = new Set(edges.map((e) => e.when).filter(Boolean));
              for (const ex of childExits) {
                if (!mapped.has(ex))
                  err(`${s.id}: uses ${child.id} but exit "${ex}" is not mapped on next.when`);
              }
            }
          }
        }
      }

      if (s.exit) {
        if (edges.length) err(`${s.id}: exit and next cannot both be set`);
        if (!j.exits?.length) err(`${s.id}: names exit "${s.exit}" but ${j.id} has no exits:`);
        else if (!exitIds.has(s.exit)) err(`${s.id}: unknown exit "${s.exit}"`);
      }

      if (s.satisfaction != null && (s.satisfaction < 1 || s.satisfaction > 5))
        err(`${s.id}: satisfaction must be 1-5`);

      for (const c of s.criteria ?? []) {
        if (!c.includes("SHALL"))
          warn(
            `${s.id}: criterion is not EARS ("WHEN <trigger> THE SYSTEM SHALL <behavior>"): ${c.slice(0, 60)}`,
          );
      }
      if (!s.criteria?.length) warn(`${s.id}: no acceptance criteria`);
    }

    if (j.exits?.length) {
      const terminals = j.steps.filter((s) => nexts(s).length === 0);
      for (const s of terminals) {
        if (!s.exit) err(`${s.id}: ${j.id} declares exits; this terminal step must name one`);
      }
      const hit = new Set(j.steps.map((s) => s.exit).filter(Boolean));
      for (const e of j.exits) {
        if (e.id && !hit.has(e.id)) warn(`${j.id}: exit "${e.id}" is never named by a step`);
      }
    }

    const start = j.entry && local.has(j.entry) ? j.entry : j.steps[0]?.id;
    for (const s of j.steps)
      if (s.id !== start && !referenced.has(s.id))
        err(`${s.id}: unreachable — no step points at it`);
    if (!j.steps.some((s) => nexts(s).length === 0))
      err(`${j.id}: no terminal step — every step has a next`);
  }

  for (const f of spine.features ?? []) {
    if (!/^F\d+$/.test(f.id)) err(`${f.id}: feature id must look like F1`);
    if (!f.serves?.length) warn(`${f.id}: serves no journey step`);
    for (const ref of f.serves ?? [])
      if (!stepIds.has(ref)) err(`${f.id}: serves unknown step "${ref}"`);
  }

  for (const sc of spine.screens ?? [])
    if (!usedScreens.has(sc.id)) warn(`screen ${sc.id}: never used by any journey step`);

  return { errors, warnings };
}

const esc = (t: string) => t.replace(/"/g, "'").replace(/\|/g, "\\|");
const cell = (t?: string) => (t ? esc(t) : "—");

function nextCell(s: Step): string {
  const parts: string[] = [];
  if (s.uses) parts.push(`uses \`${s.uses}\``);
  for (const e of nextEdges(s)) {
    parts.push(e.when ? `\`${e.to}\` · ${esc(e.when)}` : `\`${e.to}\``);
  }
  if (s.exit) parts.push(`exit \`${s.exit}\``);
  return parts.join("; ") || "—";
}

export function render(spine: Spine): string {
  const out: string[] = [];
  const actors = new Map((spine.actors ?? []).map((a) => [a.id, a]));

  out.push(`# ${spine.product ?? "Product"} — journey spine`, "");
  out.push("<!-- Generated by journey.ts. Edit the .yaml spine, not this file. -->", "");
  if (spine.source) out.push(`Design doc: [${spine.source}](${spine.source})`, "");

  if (spine.actors?.length) {
    out.push("## Actors", "", "| ID | Actor | Type |", "|---|---|---|");
    for (const a of spine.actors)
      out.push(`| \`${a.id}\` | ${esc(a.name)} | ${a.type ?? "person"} |`);
    out.push("");
  }

  for (const j of spine.journeys ?? []) {
    const who = j.actor ? (actors.get(j.actor)?.name ?? j.actor) : "—";
    out.push(`## ${j.id} · ${esc(j.title)}`, "");
    out.push(`**Actor:** ${esc(who)}`);
    if (j.goal) out.push(`**Goal:** ${esc(j.goal)}`);
    if (j.proves) out.push(`**Proves:** ${esc(j.proves)}`);
    if (j.reusable) out.push("Reusable sub-journey — other journeys include it with `uses`.");
    if (j.entry) out.push(`**Entry:** \`${j.entry}\``);
    out.push("");
    if (j.exits?.length) {
      out.push("| Exit | Title | Named by |", "|---|---|---|");
      for (const e of j.exits) {
        const named = j.steps.filter((s) => s.exit === e.id).map((s) => `\`${s.id}\``);
        out.push(`| \`${e.id}\` | ${esc(e.title ?? "") || "—"} | ${named.join(" ") || "—"} |`);
      }
      out.push("");
    }

    out.push("```mermaid", "flowchart LR");
    for (const s of j.steps) {
      const where = s.screen ? `${s.screen}${s.state ? ` · ${s.state}` : ""}` : "";
      const extra = s.uses ? `uses ${s.uses}` : "";
      const small = [where, extra].filter(Boolean).join(" · ");
      const label = small ? `${esc(s.title)}<br/><small>${small}</small>` : esc(s.title);
      out.push(`  ${s.id.replace(".", "_")}["${label}"]`);
    }
    for (const s of j.steps) {
      for (const e of nextEdges(s)) {
        const from = s.id.replace(".", "_");
        const to = e.to.replace(".", "_");
        if (e.when) out.push(`  ${from} -->|"${esc(e.when)}"| ${to}`);
        else out.push(`  ${from} --> ${to}`);
      }
    }
    out.push("```", "");

    if (j.steps.some((s) => s.satisfaction != null)) {
      out.push("```mermaid", "journey", `  title ${esc(j.title)}`, `  section ${esc(who)}`);
      for (const s of j.steps)
        if (s.satisfaction != null) out.push(`    ${esc(s.title)}: ${s.satisfaction}: ${esc(who)}`);
      out.push("```", "");
    }

    out.push(
      "| Step | Screen · state | Sees | Does | Next | Criteria |",
      "|---|---|---|---|---|---|",
    );
    for (const s of j.steps) {
      const where = s.screen ? `\`${s.screen}\`${s.state ? ` · ${s.state}` : ""}` : "—";
      out.push(
        `| \`${s.id}\` ${esc(s.title)} | ${where} | ${cell(s.sees)} | ${cell(s.does)} | ${nextCell(s)} | ${s.criteria?.length ?? 0} |`,
      );
    }
    out.push("");

    const withCriteria = j.steps.filter((s) => s.criteria?.length);
    if (withCriteria.length) {
      out.push(`### ${j.id} acceptance criteria`, "");
      for (const s of withCriteria) {
        out.push(`**\`${s.id}\`** ${esc(s.title)}`, "");
        for (const c of s.criteria ?? []) out.push(`- ${c}`);
        out.push("");
      }
    }
  }

  if (spine.screens?.length) {
    out.push(
      "## Screens",
      "",
      "| Screen | Route | Bands | States | Used by |",
      "|---|---|---|---|---|",
    );
    for (const sc of spine.screens) {
      const used = (spine.journeys ?? [])
        .flatMap((j) => j.steps)
        .filter((s) => s.screen === sc.id)
        .map((s) => `\`${s.id}\``);
      out.push(
        `| \`${sc.id}\` | ${sc.route ? `\`${sc.route}\`` : "—"} | ${sc.bands?.join(", ") ?? "—"} | ${sc.states?.join(", ") ?? "—"} | ${used.join(" ") || "—"} |`,
      );
    }
    out.push("");
  }

  if (spine.features?.length) {
    out.push("## Features", "", "| Feature | Serves | Journeys |", "|---|---|---|");
    for (const f of spine.features) {
      const js = [...new Set((f.serves ?? []).map((r) => r.split(".")[0]))].join(", ");
      out.push(
        `| \`${f.id}\` ${esc(f.title)} | ${(f.serves ?? []).map((r) => `\`${r}\``).join(" ") || "—"} | ${js || "—"} |`,
      );
    }
    out.push("");

    const served = new Set((spine.features ?? []).flatMap((f) => f.serves ?? []));
    const orphans = (spine.journeys ?? []).flatMap((j) => j.steps).filter((s) => !served.has(s.id));
    if (orphans.length) {
      out.push(
        `**Steps no feature serves yet:** ${orphans.map((s) => `\`${s.id}\``).join(" ")}`,
        "",
      );
    }
  }

  return out.join("\n");
}

export function requiredStepIds(spine: Spine): string[] {
  const byId = new Map<string, Step>();
  for (const j of spine.journeys ?? []) {
    for (const s of j.steps ?? []) byId.set(s.id, s);
  }
  const features = spine.features ?? [];
  if (!features.length) return [];
  const ids = new Set<string>();
  for (const f of features) {
    for (const ref of f.serves ?? []) {
      const step = byId.get(ref);
      if (step?.criteria?.length) ids.add(ref);
    }
  }
  return [...ids].sort();
}

export function citedStepIds(texts: string[]): Set<string> {
  const found = new Set<string>();
  const re = /\bJ\d+\.S\d+[a-z]?\b/g;
  for (const text of texts) {
    for (const m of text.matchAll(re)) found.add(m[0]);
  }
  return found;
}

export function missingStepIds(required: string[], cited: Set<string>): string[] {
  return required.filter((id) => !cited.has(id));
}

async function loadSpine(path: string): Promise<Spine> {
  try {
    return Bun.YAML.parse(await Bun.file(path).text()) as Spine;
  } catch (e) {
    throw new Error(`could not parse ${path}: ${(e as Error).message}`);
  }
}

if (import.meta.main) {
  const [cmd, file, ...rest] = process.argv.slice(2);
  if (!cmd || !["validate", "render", "ids"].includes(cmd)) {
    console.error(
      "usage: bun journey.ts <validate|render|ids> <spine.yaml|docs/journeys> [--out <file.md>]",
    );
    process.exit(2);
  }
  if ((cmd === "validate" || cmd === "render") && !file) {
    console.error("usage: bun journey.ts <validate|render> <spine.yaml> [--out <file.md>]");
    process.exit(2);
  }

  if (cmd === "ids") {
    const root = file ?? "docs/journeys";
    const glob = new Bun.Glob("*.yaml");
    const spines: string[] = [];
    const target = Bun.file(root);
    if (await target.exists()) {
      const stat = await target.stat();
      if (stat.isFile()) spines.push(root);
    }
    if (!spines.length) {
      try {
        for await (const name of glob.scan(root)) {
          if (name.endsWith(".yaml")) spines.push(`${root.replace(/\/$/, "")}/${name}`);
        }
      } catch {
        console.error(`ok: no product spines at ${root} — nothing to check.`);
        process.exit(0);
      }
    }
    if (!spines.length) {
      console.error(`ok: no product spines at ${root} — nothing to check.`);
      process.exit(0);
    }

    const testGlob = new Bun.Glob("**/*.{test,spec}.{ts,tsx}");
    const texts: string[] = [];
    for await (const path of testGlob.scan(".")) {
      if (path.includes("node_modules") || path.includes(".agents/")) continue;
      texts.push(await Bun.file(path).text());
    }
    const cited = citedStepIds(texts);

    let required: string[] = [];
    for (const path of spines) {
      let spine: Spine;
      try {
        spine = await loadSpine(path);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
      const { errors } = validateSpine(spine);
      if (errors.length) {
        for (const e of errors) console.error(`ERROR ${e}`);
        process.exit(1);
      }
      required = required.concat(requiredStepIds(spine));
    }
    required = [...new Set(required)].sort();
    if (!required.length) {
      console.error(
        "ok: spines have no features.serves yet — ID check waits until features are cut.",
      );
      process.exit(0);
    }
    const missing = missingStepIds(required, cited);
    if (missing.length) {
      console.error("ERROR journey step IDs with criteria are not cited in any test or spec:");
      for (const id of missing) console.error(`  ${id}`);
      console.error('Name the test after the step (e.g. it("J1.S3: …")).');
      process.exit(1);
    }
    console.error(`ok: ${required.length} journey ID(s) cited in tests.`);
    process.exit(0);
  }

  let spine: Spine;
  try {
    spine = Bun.YAML.parse(await Bun.file(file).text()) as Spine;
  } catch (e) {
    console.error(`could not parse ${file}: ${(e as Error).message}`);
    process.exit(1);
  }

  const { errors, warnings } = validateSpine(spine);
  for (const w of warnings) console.error(`warn  ${w}`);
  for (const e of errors) console.error(`ERROR ${e}`);

  if (errors.length) {
    console.error(
      `\n${errors.length} error(s), ${warnings.length} warning(s) — spine is not valid.`,
    );
    process.exit(1);
  }

  if (cmd === "validate") {
    console.error(`ok: ${file} is valid (${warnings.length} warning(s)).`);
    process.exit(0);
  }

  const md = render(spine);
  const outIdx = rest.indexOf("--out");
  const outPath = outIdx === -1 ? undefined : rest[outIdx + 1];
  if (outPath) {
    await Bun.write(outPath, `${md}\n`);
    console.error(`wrote ${outPath}`);
  } else {
    console.log(md);
  }
}
