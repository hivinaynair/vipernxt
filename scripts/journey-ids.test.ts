import { describe, expect, it } from "bun:test";
import {
  checkJourneyCitations,
  citedStepIds,
  missingStepIds,
  parseIdsArgs,
  requiredStepIds,
  unknownCitedIds,
} from "./journey.ts";

const spine = {
  product: "ledgerly",
  journeys: [
    {
      id: "J1",
      title: "First ledger",
      steps: [
        {
          id: "J1.S1",
          title: "Empty",
          criteria: ["WHEN an owner opens the dashboard THE SYSTEM SHALL show empty"],
        },
        {
          id: "J1.S5",
          title: "Later beat",
          criteria: ["WHEN the owner exports THE SYSTEM SHALL write a file"],
        },
        { id: "J1.S2", title: "No criteria yet" },
      ],
    },
  ],
  features: [{ id: "F1", title: "Dashboard", serves: ["J1.S1", "J1.S2", "J1.S5"] }],
};

describe("requiredStepIds", () => {
  it("only requires served steps that have criteria", () => {
    expect(requiredStepIds(spine)).toEqual(["J1.S1", "J1.S5"]);
  });

  it("is empty until features are cut", () => {
    expect(requiredStepIds({ ...spine, features: [] })).toEqual([]);
  });
});

describe("citedStepIds", () => {
  it("reads IDs out of test titles", () => {
    const cited = citedStepIds([`it("J1.S1: shows the empty dashboard", () => {})`]);
    expect(cited.has("J1.S1")).toBe(true);
    expect(missingStepIds(["J1.S1"], cited)).toEqual([]);
    expect(missingStepIds(["J1.S1", "J2.S1"], cited)).toEqual(["J2.S1"]);
  });
});

describe("unknownCitedIds", () => {
  it("flags citations that are not on the spine", () => {
    expect(unknownCitedIds(new Set(["J1.S1", "J9.S1"]), ["J1.S1", "J1.S5"])).toEqual(["J9.S1"]);
  });
});

describe("checkJourneyCitations", () => {
  it("lets a first slice leave later served steps uncited", () => {
    const cited = new Set(["J1.S1"]);
    expect(
      checkJourneyCitations({
        known: ["J1.S1", "J1.S5", "J2.S3"],
        required: ["J1.S1", "J1.S5", "J2.S3"],
        cited,
        complete: false,
      }),
    ).toEqual({ unknown: [], missing: [] });
  });

  it("complete mode fails those uncited served steps", () => {
    expect(
      checkJourneyCitations({
        known: ["J1.S1", "J1.S5", "J2.S3"],
        required: ["J1.S1", "J1.S5", "J2.S3"],
        cited: new Set(["J1.S1"]),
        complete: true,
      }),
    ).toEqual({ unknown: [], missing: ["J1.S5", "J2.S3"] });
  });

  it("fails a citation that is not a spine ID in either mode", () => {
    const cited = new Set(["J1.S1", "J9.S1"]);
    const known = ["J1.S1", "J1.S5"];
    const required = ["J1.S1", "J1.S5"];
    expect(checkJourneyCitations({ known, required, cited, complete: false }).unknown).toEqual([
      "J9.S1",
    ]);
    expect(checkJourneyCitations({ known, required, cited, complete: true }).unknown).toEqual([
      "J9.S1",
    ]);
  });
});

describe("parseIdsArgs", () => {
  it("defaults the journeys dir and treats --complete as a flag", () => {
    expect(parseIdsArgs([])).toEqual({ root: "docs/journeys", complete: false });
    expect(parseIdsArgs(["--complete"])).toEqual({ root: "docs/journeys", complete: true });
    expect(parseIdsArgs(["docs/journeys/app.yaml", "--complete"])).toEqual({
      root: "docs/journeys/app.yaml",
      complete: true,
    });
  });
});

describe("ids CLI", () => {
  const example = `${import.meta.dir}/../.agents/skills/journeys/example.yaml`;
  const root = `${import.meta.dir}/..`;

  it("lets a slice leave served steps uncited", () => {
    const result = Bun.spawnSync({
      cmd: ["bun", "scripts/journey.ts", "ids", example],
      cwd: root,
      stderr: "pipe",
      stdout: "pipe",
    });
    expect(result.exitCode).toBe(0);
    expect(result.stderr.toString()).toContain("not yet cited");
  });

  it("requires every served step only with --complete", () => {
    const result = Bun.spawnSync({
      cmd: ["bun", "scripts/journey.ts", "ids", example, "--complete"],
      cwd: root,
      stderr: "pipe",
      stdout: "pipe",
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("J1.S3");
  });
});
