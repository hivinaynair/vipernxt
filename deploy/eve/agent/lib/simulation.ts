import type { Manifest } from "./contract.js";

/** A technical benchmark is explicitly enabled for one disposable repository. */
export function simulationIntake(
  manifest: Manifest,
  repo: string,
  configuredRepo: string | undefined,
  target: string,
) {
  if (!manifest.simulation) return false;
  if (!configuredRepo || configuredRepo !== repo || target !== "staging")
    throw new Error(
      "Hosted simulation requires the explicitly configured disposable staging repository",
    );
  if (
    manifest.jobs.length > 2 ||
    manifest.limits.attempts > 2 ||
    manifest.limits.jobSeconds > 1200 ||
    manifest.limits.runSeconds > 7200
  )
    throw new Error("Hosted simulation exceeds the two-slice benchmark budget");
  return true;
}
