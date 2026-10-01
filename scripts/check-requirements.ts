import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readinessPath, validateReadiness } from "./lib/requirements-readiness.js";

const path = readinessPath(process.argv[2] ?? "docs/product/requirements.json");
if (!existsSync(path) && !process.argv[2]) {
  console.log("No engagement requirements packet; kit has no product readiness claim.");
} else {
  try {
    const packetText = readFileSync(path, "utf8"),
      p = JSON.parse(packetText);
    const coverageFile = readinessPath(p.coverageFile),
      stateFile = readinessPath(p.stateFile);
    const specFiles = [
      ...new Set<string>([
        path,
        stateFile,
        coverageFile,
        ...p.artifacts.map((a: { path: unknown }) => readinessPath(a.path)),
      ]),
    ];
    const files = Object.fromEntries(specFiles.map((f) => [f, readFileSync(resolve(f), "utf8")]));
    const coverage = JSON.parse(files[coverageFile]);
    if (coverage.approval !== p.approval) throw new Error("Coverage approval differs from packet");
    const result = validateReadiness({
      coverageFile,
      file: path,
      packetText,
      approval: coverage.approval,
      scope: coverage.scope,
      specFiles,
      files,
      state: Bun.YAML.parse(files[stateFile]),
      requirementIds: coverage.requirements.map((r: { id: string }) => r.id),
      staging: Boolean(coverage.deployed?.automatic),
      requiredArtifacts: [
        coverageFile,
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
    console.log(`Requirements ready: ${result.scope} ${result.sha256}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid requirements packet");
    process.exitCode = 1;
  }
}
