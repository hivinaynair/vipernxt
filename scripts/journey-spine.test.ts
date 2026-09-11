import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { nextEdges, render, validateSpine } from "./journey.ts";

const base = {
  product: "ledgerly",
  actors: [{ id: "owner", name: "Owner" }],
  screens: [
    { id: "dash", states: ["empty", "loaded"] },
    { id: "ledger", states: ["importing", "reconciled", "rejected"] },
  ],
};

describe("nextEdges", () => {
  it("keeps a bare id and a labeled edge", () => {
    expect(nextEdges({ id: "J1.S1", title: "a", next: "J1.S2" })).toEqual([{ to: "J1.S2" }]);
    expect(
      nextEdges({
        id: "J1.S2",
        title: "b",
        next: [
          { to: "J1.S3", when: "supported file" },
          { to: "J1.S2b", when: "unsupported format" },
        ],
      }),
    ).toEqual([
      { to: "J1.S3", when: "supported file" },
      { to: "J1.S2b", when: "unsupported format" },
    ]);
  });
});

describe("validateSpine", () => {
  it("accepts labeled next, named exits, and uses", () => {
    const { errors } = validateSpine({
      ...base,
      journeys: [
        {
          id: "J0",
          title: "Open",
          reusable: true,
          exits: [{ id: "opened" }],
          steps: [
            { id: "J0.S1", title: "Open", screen: "ledger", state: "reconciled", exit: "opened" },
          ],
        },
        {
          id: "J1",
          title: "Import",
          actor: "owner",
          exits: [{ id: "matched" }, { id: "rejected" }],
          steps: [
            { id: "J1.S1", title: "Empty", screen: "dash", state: "empty", next: "J1.S2" },
            {
              id: "J1.S2",
              title: "Upload",
              screen: "ledger",
              state: "importing",
              next: [
                { to: "J1.S3", when: "supported file" },
                { to: "J1.S2b", when: "unsupported format" },
              ],
            },
            {
              id: "J1.S2b",
              title: "Refused",
              screen: "ledger",
              state: "rejected",
              exit: "rejected",
            },
            { id: "J1.S3", title: "Match", screen: "ledger", state: "reconciled", exit: "matched" },
          ],
        },
        {
          id: "J2",
          title: "Flag",
          steps: [
            { id: "J2.S1", title: "Via J0", uses: "J0", next: [{ to: "J2.S2", when: "opened" }] },
            { id: "J2.S2", title: "Flag", screen: "ledger", state: "reconciled" },
          ],
        },
      ],
    });
    expect(errors).toEqual([]);
  });

  it("accepts script/judgment steps with no screen, rejects a bad bucket", () => {
    const { errors, warnings } = validateSpine({
      ...base,
      journeys: [
        {
          id: "J1",
          title: "Gate",
          steps: [
            { id: "J1.S1", title: "Ingest", bucket: "script", next: "J1.S2" },
            { id: "J1.S2", title: "Propose", bucket: "judgment", next: "J1.S3" },
            { id: "J1.S3", title: "Sign off", bucket: "human", screen: "dash", state: "loaded" },
          ],
        },
      ],
    });
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.includes("no screen"))).toBe(false);
    expect(warnings.some((w) => w.includes("no bucket"))).toBe(false);

    const bad = validateSpine({
      ...base,
      journeys: [
        {
          id: "J1",
          title: "Bad",
          steps: [{ id: "J1.S1", title: "X", bucket: "agent" }],
        },
      ],
    });
    expect(bad.errors.some((e) => e.includes("bucket must be"))).toBe(true);
  });

  it("warns when bucket and screen are both missing", () => {
    const { warnings } = validateSpine({
      ...base,
      journeys: [
        {
          id: "J1",
          title: "Untagged",
          steps: [{ id: "J1.S1", title: "Does a thing" }],
        },
      ],
    });
    expect(warnings.some((w) => w.includes("no bucket"))).toBe(true);
    expect(warnings.some((w) => w.includes("no screen"))).toBe(true);
  });

  it("rejects exit plus next, unknown uses, and unmapped child exits", () => {
    const { errors } = validateSpine({
      ...base,
      journeys: [
        {
          id: "J0",
          title: "Open",
          reusable: true,
          exits: [{ id: "opened" }, { id: "denied" }],
          steps: [{ id: "J0.S1", title: "Open", exit: "opened" }],
        },
        {
          id: "J1",
          title: "Bad",
          exits: [{ id: "done" }],
          steps: [
            {
              id: "J1.S1",
              title: "Both",
              next: "J1.S2",
              exit: "done",
            },
            { id: "J1.S2", title: "End", uses: "J9" },
          ],
        },
        {
          id: "J2",
          title: "Partial map",
          steps: [
            { id: "J2.S1", title: "Via J0", uses: "J0", next: [{ to: "J2.S2", when: "opened" }] },
            { id: "J2.S2", title: "After" },
          ],
        },
      ],
    });
    expect(errors.some((e) => e.includes("exit and next"))).toBe(true);
    expect(errors.some((e) => e.includes("unknown journey"))).toBe(true);
    expect(errors.some((e) => e.includes('exit "denied"'))).toBe(true);
  });

  it("requires a named exit on every terminal when exits are declared", () => {
    const { errors } = validateSpine({
      ...base,
      journeys: [
        {
          id: "J1",
          title: "Import",
          exits: [{ id: "matched" }],
          steps: [{ id: "J1.S1", title: "End", screen: "dash", state: "empty" }],
        },
      ],
    });
    expect(errors.some((e) => e.includes("must name one"))).toBe(true);
  });
});

describe("render", () => {
  it("labels mermaid edges and lists exits", () => {
    const md = render({
      product: "ledgerly",
      journeys: [
        {
          id: "J1",
          title: "Import",
          exits: [{ id: "matched", title: "Balance matches" }],
          steps: [
            {
              id: "J1.S1",
              title: "Upload",
              next: [{ to: "J1.S2", when: "supported file" }],
            },
            { id: "J1.S2", title: "Done", exit: "matched" },
          ],
        },
      ],
    });
    expect(md).toContain('|"supported file"|');
    expect(md).toContain("| `matched` |");
    expect(md).toContain("exit `matched`");
  });

  it("renders bucket in the step table", () => {
    const md = render({
      product: "clip",
      journeys: [
        {
          id: "J1",
          title: "Gate",
          steps: [{ id: "J1.S1", title: "Propose", bucket: "judgment" }],
        },
      ],
    });
    expect(md).toContain("| Step | Bucket |");
    expect(md).toContain("| `J1.S1` Propose | judgment |");
  });
});

describe("kit examples", () => {
  it("replace and wrap examples validate", () => {
    const dir = join(import.meta.dir, "../.agents/skills/journeys");
    for (const name of ["example.yaml", "example-wrap.yaml"]) {
      const spine = Bun.YAML.parse(readFileSync(join(dir, name), "utf8"));
      const { errors } = validateSpine(spine as Parameters<typeof validateSpine>[0]);
      expect(errors, name).toEqual([]);
    }
  });
});
