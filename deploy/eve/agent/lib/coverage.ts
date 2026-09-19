import { z } from "zod";
import type { Manifest } from "./contract.js";

const id = z.string().trim().min(1);
export const coverageSchema = z
  .object({
    version: z.literal(1),
    approval: id,
    scope: z.enum(["first-slice", "mvp"]),
    spineFile: id,
    exclusions: z.array(z.object({ step: id, criterion: id, reason: id }).strict()),
    foundations: z.object(
      Object.fromEntries(
        ["authentication", "tenancy", "authorization", "persistence"].map((name) => [
          name,
          z.discriminatedUnion("applies", [
            z.object({ applies: z.literal(false), reason: id }).strict(),
            z
              .object({
                applies: z.literal(true),
                requirements: z.array(id).min(1),
                consumers: z.array(id).min(1),
              })
              .strict(),
          ]),
        ]),
      ),
    ),
    integrated: z
      .object({
        checks: z.array(z.array(id).min(1)).min(1),
        browser: z.array(id).min(1).optional(),
      })
      .strict(),
    requirements: z
      .array(
        z
          .object({
            id,
            step: id,
            criterion: id,
            dependsOn: z.array(id),
            delivery: z.discriminatedUnion("kind", [
              z.object({ kind: z.literal("job"), job: id }).strict(),
              z
                .object({
                  kind: z.literal("existing"),
                  commit: z.string().regex(/^[a-f0-9]{40}$/),
                  evidence: id,
                })
                .strict(),
            ]),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

// The approved catalog is separate from jobs: omitting a job cannot silently
// shrink scope. This checks structural coverage, not completeness of discovery.
export function validateCoverage(value: unknown, manifest: Manifest, spine: unknown) {
  const catalog = coverageSchema.parse(value);
  if (!manifest.specFiles.includes(catalog.spineFile))
    throw new Error("Journey spine must be pinned");
  const parsedSpine = z
    .object({
      journeys: z
        .array(
          z.object({
            steps: z
              .array(z.object({ id, screen: id.optional(), criteria: z.array(id).min(1) }))
              .min(1),
          }),
        )
        .min(1),
    })
    .parse(spine);
  const steps = parsedSpine.journeys.flatMap((j) => j.steps);
  if (new Set(steps.map((s) => s.id)).size !== steps.length)
    throw new Error("Duplicate spine step ID");
  if (
    steps.some((s) => s.screen && catalog.requirements.some((r) => r.step === s.id)) &&
    !catalog.integrated.browser
  )
    throw new Error("Interactive journeys require integrated browser verification");
  const source = parsedSpine.journeys.flatMap((j) =>
    j.steps.flatMap((s) => s.criteria.map((criterion) => ({ step: s.id, criterion }))),
  );
  const key = (r: { step: string; criterion: string }) => JSON.stringify([r.step, r.criterion]);
  const sourceKeys = new Set(source.map(key));
  if (sourceKeys.size !== source.length) throw new Error("Duplicate spine criterion");
  const assigned = [...catalog.requirements, ...catalog.exclusions];
  if (new Set(assigned.map(key)).size !== assigned.length)
    throw new Error("Duplicate criterion assignment");
  if (assigned.some((r) => !sourceKeys.has(key(r))))
    throw new Error("Criterion outside approved spine");
  if (source.some((r) => !assigned.some((a) => key(a) === key(r))))
    throw new Error("Uncovered spine criterion");
  if (catalog.scope === "mvp" && catalog.exclusions.length)
    throw new Error("MVP cannot exclude approved spine criteria; revise approved scope first");
  const requirements = new Map(catalog.requirements.map((r) => [r.id, r]));
  if (requirements.size !== catalog.requirements.length)
    throw new Error("Duplicate requirement ID");
  const jobs = new Map(manifest.jobs.map((j) => [j.id, j]));
  const ancestors = (job: string): Set<string> => {
    const result = new Set<string>();
    const visit = (id: string) => {
      for (const dep of jobs.get(id)?.dependsOn ?? []) {
        if (!result.has(dep)) {
          result.add(dep);
          visit(dep);
        }
      }
    };
    visit(job);
    return result;
  };
  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (id: string) => {
    const r = requirements.get(id);
    if (!r) throw new Error(`Unknown requirement dependency: ${id}`);
    if (visiting.has(id)) throw new Error("Requirement dependency cycle");
    if (done.has(id)) return;
    visiting.add(id);
    for (const dep of r.dependsOn) visit(dep);
    visiting.delete(id);
    done.add(id);
  };
  for (const r of catalog.requirements) {
    visit(r.id);
    const d = r.delivery;
    if (d.kind === "job") {
      if (!jobs.get(d.job)?.steps.includes(r.step))
        throw new Error(`Uncovered requirement: ${r.id}`);
    } else if (d.commit !== manifest.base || !manifest.specFiles.includes(d.evidence)) {
      throw new Error(`Existing requirement needs pinned evidence at approved base: ${r.id}`);
    }
    for (const depId of r.dependsOn) {
      const dep = requirements.get(depId)!;
      if (dep.delivery.kind === "existing") continue;
      if (
        d.kind === "existing" ||
        (d.job !== dep.delivery.job && !ancestors(d.job).has(dep.delivery.job))
      ) {
        throw new Error(`Missing prerequisite ordering: ${r.id} requires ${depId}`);
      }
    }
  }
  for (const [name, foundation] of Object.entries(catalog.foundations)) {
    if (!foundation.applies) continue;
    for (const prerequisite of foundation.requirements) {
      if (!requirements.has(prerequisite)) throw new Error(`Unknown ${name} foundation`);
      for (const consumer of foundation.consumers) {
        const r = requirements.get(consumer);
        if (!r || (consumer !== prerequisite && !r.dependsOn.includes(prerequisite)))
          throw new Error(`Missing ${name} prerequisite: ${consumer}`);
      }
    }
  }
  for (const job of manifest.jobs) {
    for (const step of job.steps) {
      if (
        !catalog.requirements.some(
          (r) => r.step === step && r.delivery.kind === "job" && r.delivery.job === job.id,
        )
      ) {
        throw new Error(`Job step outside approved coverage: ${job.id}/${step}`);
      }
    }
  }
  return catalog;
}

export type Coverage = z.infer<typeof coverageSchema>;
