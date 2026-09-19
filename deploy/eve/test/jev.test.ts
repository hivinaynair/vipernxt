import { describe, expect, test } from "bun:test";
import { attentionFor, classifyFailure, eveMayResume, type Failure } from "../agent/lib/jev.js";

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
    expect(result.attention).toBe("eve");
    expect(result.execution).toBe("hold");
    expect(result.mode).toBe("shadow");
    expect(eveMayResume(result)).toBe(true);
  });
  test("ask_owner and stop need the owner; other routes go to Eve", () => {
    expect(attentionFor("ask_owner")).toBe("owner");
    expect(attentionFor("stop")).toBe("owner");
    expect(attentionFor("repair")).toBe("eve");
    expect(attentionFor("retry_read")).toBe("eve");
    expect(attentionFor("investigate")).toBe("eve");
    expect(eveMayResume({ attention: "eve", recommendation: "investigate" })).toBe(false);
  });
  test("invalid Cursor model is owner configuration, not an Eve repair", async () => {
    let calls = 0;
    const result = await classifyFailure(
      {
        ...failure,
        stage: "review",
        summary: `Cursor HTTP 400: {"error":{"code":"invalid_model","message":"Model 'x' is not available or invalid."}}`,
      },
      async () => {
        calls++;
        return { choice: "repair" };
      },
    );
    expect(result.recommendation).toBe("ask_owner");
    expect(result.attention).toBe("owner");
    expect(eveMayResume(result)).toBe(false);
    expect(calls).toBe(0);
  });
  test("scope and budget failures bypass the model and need the owner", async () => {
    let calls = 0;
    for (const patch of [{ scopeValid: false }, { budgetAvailable: false }]) {
      const result = await classifyFailure({ ...failure, ...patch }, async () => {
        calls++;
        return { choice: "repair" };
      });
      expect(result.recommendation).toBe("stop");
      expect(result.attention).toBe("owner");
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
