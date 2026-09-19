import { expect, test } from "bun:test";
import { assertApprovedIntake } from "../agent/lib/intake.js";

const graph: Record<string, Record<string, boolean>> = {
  aaaa: { aaaa: true, bbbb: true, cccc: true },
  bbbb: { bbbb: true, cccc: true },
  cccc: { cccc: true },
};
const ancestor = async (base: string, tip: string) => graph[base]?.[tip] === true;

test("intake may sit on a descendant of the approved worker base", async () => {
  await assertApprovedIntake({
    intake: "bbbb",
    base: "aaaa",
    targetHead: "cccc",
    isAncestor: ancestor,
  });
});

test("rejects an intake that is not on the target branch", async () => {
  await expect(
    assertApprovedIntake({
      intake: "cccc",
      base: "aaaa",
      targetHead: "bbbb",
      isAncestor: ancestor,
    }),
  ).rejects.toThrow("Intake commit is not on the target branch");
});

test("rejects a base that is not an ancestor of the intake", async () => {
  await expect(
    assertApprovedIntake({
      intake: "aaaa",
      base: "bbbb",
      targetHead: "cccc",
      isAncestor: ancestor,
    }),
  ).rejects.toThrow("Approved base is not an ancestor of the intake commit");
});

test("identical intake, base, and head still register", async () => {
  await assertApprovedIntake({
    intake: "aaaa",
    base: "aaaa",
    targetHead: "aaaa",
    isAncestor: ancestor,
  });
});
