import { describe, expect, it } from "bun:test";
import { citedStepIds, missingStepIds, requiredStepIds } from "./journey.ts";

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
        { id: "J1.S2", title: "No criteria yet" },
      ],
    },
  ],
  features: [{ id: "F1", title: "Dashboard", serves: ["J1.S1", "J1.S2"] }],
};

describe("requiredStepIds", () => {
  it("only requires served steps that have criteria", () => {
    expect(requiredStepIds(spine)).toEqual(["J1.S1"]);
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
