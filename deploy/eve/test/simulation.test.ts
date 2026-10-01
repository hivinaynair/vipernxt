import { expect, test } from "bun:test";
import type { Manifest } from "../agent/lib/contract.js";
import { simulationIntake } from "../agent/lib/simulation.js";

const benchmark = {
  simulation: true,
  jobs: [{}, {}],
  limits: { attempts: 2, jobSeconds: 1200, runSeconds: 7200 },
} as Manifest;

test("normal intake retains observed customer walkthroughs even on a test deployment", () => {
  expect(
    simulationIntake(
      { ...benchmark, simulation: undefined },
      "owner/test",
      "owner/test",
      "staging",
    ),
  ).toBe(false);
});
test("synthetic hosted intake requires an explicit repository and staging binding", () => {
  for (const [configured, target] of [
    [undefined, "staging"],
    ["owner/other", "staging"],
    ["owner/test", "main"],
  ])
    expect(() => simulationIntake(benchmark, "owner/test", configured, target!)).toThrow(
      "disposable",
    );
  expect(simulationIntake(benchmark, "owner/test", "owner/test", "staging")).toBe(true);
});
test("a hosted benchmark cannot silently expand its stations or time budget", () => {
  for (const manifest of [
    { ...benchmark, jobs: [{}, {}, {}] },
    { ...benchmark, limits: { ...benchmark.limits, attempts: 3 } },
    { ...benchmark, limits: { ...benchmark.limits, jobSeconds: 1201 } },
    { ...benchmark, limits: { ...benchmark.limits, runSeconds: 7201 } },
  ])
    expect(() =>
      simulationIntake(manifest as Manifest, "owner/test", "owner/test", "staging"),
    ).toThrow("budget");
});
