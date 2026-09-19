import { createHash } from "node:crypto";
import { z } from "zod";

const sha = z.string().regex(/^[a-f0-9]{40}$/);
const path = z
  .string()
  .regex(/^[A-Za-z0-9_.@/-]+$/)
  .refine((p) => p.split("/").every((part) => part !== "" && part !== "." && part !== ".."));
const command = z.array(z.string().min(1)).min(1);
export const manifestSchema = z.object({
  version: z.literal(1),
  id: z.string().regex(/^[a-z0-9-]+$/),
  base: sha,
  approval: z.string().min(1),
  verification: z.literal("cursor-cloud"),
  specFiles: z.array(path).min(1),
  setup: z.array(command),
  worker: z.object({ kind: z.literal("cursor"), repository: z.string() }),
  limits: z.object({
    attempts: z.number().int().min(1).max(3),
    jobSeconds: z.number().int().min(60).max(7200),
    runSeconds: z.number().int().min(60).max(86400),
  }),
  jobs: z
    .array(
      z.object({
        id: z.string().regex(/^[A-Za-z0-9_-]+$/),
        title: z.string().min(1),
        instructions: z.string().min(1),
        steps: z.array(z.string().min(1)).min(1),
        dependsOn: z.array(z.string()),
        paths: z.array(path).min(1),
        checks: z.array(command).min(1),
        requiresBrowser: z.boolean(),
        browser: command.optional(),
      }),
    )
    .min(1)
    .max(30),
  combinedChecks: z.array(command).min(1),
});
export type Manifest = z.infer<typeof manifestSchema>;
export type Job = Manifest["jobs"][number];
export function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function intake(body: string) {
  const matches = [...body.matchAll(/```factory-batch\s*\n([\s\S]*?)\n```/g)];
  if (matches.length !== 1)
    throw new Error("Issue needs exactly one factory-batch block with commit and manifest path");
  return z.object({ commit: sha, manifest: path }).strict().parse(JSON.parse(matches[0][1]));
}
export function validateManifest(value: unknown, repo: string): Manifest {
  const m = manifestSchema.parse(value);
  if (m.worker.repository !== `https://github.com/${repo}`)
    throw new Error("Manifest repository differs from deployment");
  const seen = new Set<string>();
  for (const job of m.jobs) {
    if (seen.has(job.id) || job.dependsOn.some((id) => !seen.has(id)))
      throw new Error("Jobs must be unique and ordered after dependencies");
    if (job.requiresBrowser && !job.browser) throw new Error("Browser evidence command missing");
    if (
      new Set(job.steps).size !== job.steps.length ||
      new Set(job.dependsOn).size !== job.dependsOn.length
    )
      throw new Error("Duplicate journey steps or dependencies");
    seen.add(job.id);
  }
  return m;
}
export function verificationCommands(m: Manifest, j: Job) {
  return [...m.setup, ...j.checks, ...(j.browser ? [j.browser] : []), ...m.combinedChecks];
}
export function checkReview(value: unknown, commit: string, commands: string[][], steps: string[]) {
  const r = z
    .object({
      commit: sha,
      approved: z.boolean(),
      unchanged: z.boolean(),
      findings: z.array(z.string()),
      checks: z.array(
        z.object({ command, exitCode: z.number().int(), evidence: z.string().trim().min(1) }),
      ),
      criteria: z.array(
        z.object({ step: z.string(), passed: z.boolean(), evidence: z.string().trim().min(1) }),
      ),
    })
    .strict()
    .parse(value);
  const expected = commands.map((c) => JSON.stringify(c)).sort();
  const actual = r.checks.map((c) => JSON.stringify(c.command)).sort();
  if (
    r.commit !== commit ||
    !r.approved ||
    !r.unchanged ||
    r.findings.length ||
    r.checks.some((c) => c.exitCode !== 0) ||
    JSON.stringify(actual) !== JSON.stringify(expected) ||
    r.criteria.some((c) => !c.passed) ||
    JSON.stringify(r.criteria.map((c) => c.step).sort()) !== JSON.stringify([...steps].sort())
  ) {
    throw new Error("Independent review did not satisfy the pinned acceptance contract");
  }
  return r;
}
export function validateDiff(
  files: { filename: string; previous_filename?: string }[],
  job: Job,
  pinned: string[],
) {
  const allowed = (name: string) => job.paths.some((p) => name === p || name.startsWith(`${p}/`));
  for (const f of files)
    for (const name of [f.filename, f.previous_filename].filter(Boolean) as string[]) {
      if (
        !allowed(name) ||
        pinned.includes(name) ||
        name.startsWith(".github/") ||
        name.startsWith(".factory/")
      )
        throw new Error(`Changed path outside approved scope: ${name}`);
    }
}
