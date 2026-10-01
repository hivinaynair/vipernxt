import { parse as parseYaml } from "yaml";
import { assertBunTargets } from "./bun-targets.js";
import type { Manifest } from "./contract.js";
import { validateCoverage } from "./coverage.js";
import { validateReadiness } from "./requirements-readiness.js";

/** Shared intake validation; live registration never allows synthetic walkthroughs. */
export async function approvedContract(
  manifest: Manifest,
  commit: string,
  read: (path: string, ref: string) => Promise<{ text: string }>,
  options: { allowSimulation?: boolean } = {},
) {
  const files: Record<string, string> = {};
  for (const path of manifest.specFiles) files[path] = (await read(path, commit)).text;
  const catalog = JSON.parse(files[manifest.coverageFile]);
  const coverage = validateCoverage(catalog, manifest, parseYaml(files[catalog.spineFile]));
  for (const argv of [
    ...coverage.integrated.checks,
    ...(coverage.integrated.browser ? [coverage.integrated.browser] : []),
    ...(coverage.deployed?.checks ?? []),
    ...(coverage.deployed?.browser ? [coverage.deployed.browser] : []),
    ...(coverage.deployed?.automatic?.setup ?? []),
    ...(coverage.deployed?.automatic ? [coverage.deployed.automatic.command] : []),
  ])
    assertBunTargets(argv, manifest.specFiles);
  const packet = JSON.parse(files[manifest.requirementsFile]);
  const readiness = validateReadiness({
    coverageFile: manifest.coverageFile,
    file: manifest.requirementsFile,
    packetText: files[manifest.requirementsFile],
    approval: manifest.approval,
    scope: coverage.scope,
    specFiles: manifest.specFiles,
    files,
    state: parseYaml(files[packet.stateFile]),
    requirementIds: coverage.requirements.map((r) => r.id),
    allowSimulation: options.allowSimulation,
    staging: Boolean(coverage.deployed?.automatic),
    requiredArtifacts: [
      manifest.coverageFile,
      coverage.spineFile,
      ...(coverage.accessFile ? [coverage.accessFile] : []),
      ...(coverage.deployed?.automatic
        ? [
            coverage.deployed.automatic.workflow,
            ".github/scripts/factory-staging.ts",
            ...coverage.deployed.automatic.sources,
          ]
        : []),
    ],
  });
  return { coverage, readiness };
}
