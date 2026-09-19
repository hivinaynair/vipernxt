import { describe, expect, test } from "bun:test";
import { classifyFailure, type Failure } from "../agent/lib/jev.js";

const failure: Failure = {
  stage: "build",
  code: "check_failed",
  summary: "Selector returned wrong ordering",
  retriesRemaining: 1,
  scopeValid: true,
  budgetAvailable: true,
};
describe("Jev shadow boundary", () => {
  test("even a certain repair recommendation cannot execute", async () => {
    const result = await classifyFailure(failure, async () => ({
      choice: "repair",
      probabilities: { retry_read: 0, repair: 1, investigate: 0, ask_owner: 0, stop: 0 },
    }));
    expect(result.recommendation).toBe("repair");
    expect(result.execution).toBe("hold");
    expect(result.mode).toBe("shadow");
  });
  test("scope and budget failures bypass the model", async () => {
    let calls = 0;
    for (const patch of [{ scopeValid: false }, { budgetAvailable: false }]) {
      const result = await classifyFailure({ ...failure, ...patch }, async () => {
        calls++;
        return { choice: "repair" };
      });
      expect(result.recommendation).toBe("stop");
    }
    expect(calls).toBe(0);
  });
  test("provider failure stays held and omits sensitive error text", async () => {
    const result = await classifyFailure(failure, async () => {
      throw new Error("secret-token");
    });
    expect(result.status).toBe("unavailable");
    expect(result.execution).toBe("hold");
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });
  test("invalid choices or probabilities cannot become a route", async () => {
    for (const answer of [
      { choice: "merge" },
      { choice: "repair", probabilities: { repair: 1.5 } },
    ]) {
      expect((await classifyFailure(failure, async () => answer)).status).toBe("unavailable");
    }
  });
  test("changed evidence has a different audit key", async () => {
    const evaluator = async () => ({ choice: "investigate" });
    const a = await classifyFailure(failure, evaluator);
    const b = await classifyFailure({ ...failure, summary: "Logs unavailable" }, evaluator);
    expect(a.evidenceHash).not.toBe(b.evidenceHash);
  });
});
