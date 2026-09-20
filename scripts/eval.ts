#!/usr/bin/env bun
/**
 * Scores a slice against the eval set.
 *
 *   bun scripts/eval.ts
 *   bun scripts/eval.ts --json
 *
 * `/next` says the last ten real cases ARE the eval set, and `plan` says the
 * first slice is scored against them "not tests pass". Those are different
 * claims: tests say the code does what the spine specified, the eval set says
 * the product would have caught the things that actually went wrong. A slice
 * can be green and still score 2/10.
 *
 * So this prints a score and does not gate a merge. It exits non-zero only
 * when a case throws -- a broken harness is a real failure; a low score is a
 * finding for the checkpoint.
 *
 * Cases live next to the code they exercise, in `*.eval.ts` under apps/,
 * packages/ or e2e/, each default-exporting `EvalCase[]`. Ids are the site's
 * own refs from docs/research/eval-set.md, so a row here and a row there are
 * obviously the same case.
 */

type EvalCaseBase = {
  evidence?: "real" | "synthetic";
  /** The site's own id for this case (`PBC-14`, `job-2291`). Not an index. */
  id: string;
  title: string;
  /** Which journey steps this case exercises. Optional but recommended. */
  steps?: string[];
};

/**
 * A case either runs or is skipped with a reason — never both, and never
 * neither. A skip with no reason is how six unhandled cases quietly become a
 * perfect score.
 */
export type EvalCase =
  | (EvalCaseBase & {
      /**
       * `true` = the slice handles this case correctly. Throwing is a harness
       * failure, not a low score.
       */
      run: () => boolean | Promise<boolean>;
      skip?: never;
    })
  | (EvalCaseBase & {
      /** Why this case is out of the current slice. Reported, never a pass. */
      skip: string;
      run?: never;
    });

export type EvalOutcome = {
  id: string;
  title: string;
  steps: string[];
  status: "pass" | "fail" | "skip" | "error";
  detail?: string;
};

export function summarise(outcomes: EvalOutcome[]) {
  const pass = outcomes.filter((o) => o.status === "pass").length;
  const fail = outcomes.filter((o) => o.status === "fail").length;
  const skip = outcomes.filter((o) => o.status === "skip").length;
  const error = outcomes.filter((o) => o.status === "error").length;
  // Skipped cases leave the denominator: a slice that skips nine of ten has
  // not scored 1/1.
  return { pass, fail, skip, error, scored: pass + fail, total: outcomes.length };
}

export function formatReport(outcomes: EvalOutcome[]): string {
  const s = summarise(outcomes);
  const lines: string[] = [];
  const mark = { pass: "pass", fail: "FAIL", skip: "skip", error: "ERROR" } as const;

  for (const o of outcomes) {
    const steps = o.steps.length ? ` (${o.steps.join(", ")})` : "";
    lines.push(`  ${mark[o.status].padEnd(5)} ${o.id}  ${o.title}${steps}`);
    if (o.detail) lines.push(`        ${o.detail}`);
  }

  lines.push("");
  // Lead with the whole eval set, never with the attempted subset. "4/4" on a
  // slice that skipped six of the site's ten real cases reads as a perfect
  // score, which is the opposite of what happened.
  lines.push(
    `score: ${s.pass} of ${s.total} cases handled` +
      (s.skip ? ` — ${s.scored} attempted, ${s.skip} out of this slice` : ""),
  );
  if (s.error)
    lines.push(`${s.error} case(s) could not run — fix the harness before reading the score.`);
  return lines.join("\n");
}

export async function runCases(cases: EvalCase[]): Promise<EvalOutcome[]> {
  const outcomes: EvalOutcome[] = [];
  for (const c of cases) {
    const base = { id: c.id, title: c.title, steps: c.steps ?? [] };
    if (c.skip) {
      outcomes.push({ ...base, status: "skip", detail: c.skip });
      continue;
    }
    try {
      if (!c.run) throw new Error("Eval case has neither run nor a skip reason");
      const ok = await c.run();
      outcomes.push({ ...base, status: ok ? "pass" : "fail" });
    } catch (e) {
      outcomes.push({ ...base, status: "error", detail: (e as Error).message });
    }
  }
  return outcomes;
}

/** Duplicate ids mean two people wrote the same case; the score would lie. */
export function duplicateIds(cases: EvalCase[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const c of cases) {
    if (seen.has(c.id)) dupes.add(c.id);
    seen.add(c.id);
  }
  return [...dupes].sort();
}

export async function discover(root: string): Promise<EvalCase[]> {
  const glob = new Bun.Glob("**/*.eval.ts");
  const found: EvalCase[] = [];
  const { existsSync } = await import("node:fs");
  for (const dir of ["apps", "packages", "e2e"]) {
    if (!existsSync(`${root}/${dir}`)) continue;
    for (const rel of [...glob.scanSync(`${root}/${dir}`)].sort()) {
      if (rel.split("/").includes("node_modules")) continue;
      const file = `${root}/${dir}/${rel}`;
      let cases: unknown;
      try {
        const mod = await import(file);
        cases = mod.default ?? mod.cases;
      } catch {
        throw new Error(`Cannot load eval module ${file}`);
      }
      if (!Array.isArray(cases)) throw new Error(`${file} must export EvalCase[]`);
      for (const c of cases) {
        if (
          !c ||
          typeof c.id !== "string" ||
          !c.id.trim() ||
          typeof c.title !== "string" ||
          !(
            (typeof c.run === "function" && c.skip === undefined) ||
            (typeof c.skip === "string" && c.skip.trim() && c.run === undefined)
          )
        ) {
          throw new Error(
            `Invalid eval case in ${file}: require id, title, and either run or a nonempty skip reason`,
          );
        }
      }
      found.push(...cases);
    }
  }
  return found;
}

if (import.meta.main) {
  const root = process.cwd();
  let cases: EvalCase[];
  try {
    cases = await discover(root);
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }

  if (!cases.length) {
    console.log(
      "No eval cases yet. Write docs/research/eval-set.md from the last ten real\n" +
        "cases, then a *.eval.ts beside the code that handles them. The first slice\n" +
        "is scored on these, not on the test suite.",
    );
    process.exit(process.argv.includes("--require-cases") ? 1 : 0);
  }

  const dupes = duplicateIds(cases);
  if (dupes.length) {
    console.error(`Duplicate eval case ids: ${dupes.join(", ")}`);
    process.exit(1);
  }

  const outcomes = await runCases(cases);

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ outcomes, ...summarise(outcomes) }, null, 2));
  } else {
    console.log(formatReport(outcomes));
  }

  process.exit(summarise(outcomes).error ? 1 : 0);
}
