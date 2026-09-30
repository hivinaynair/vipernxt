import { expect, test } from "bun:test";

test("durable driver survives adoption and hosted hook conflicts without new attempts or clocks", async () => {
  // Isolate virtual Workflow SDK mocks from the engine/provider tests.
  const job = Bun.spawn(
    [process.execPath, new URL("./fixtures/durable-driver.eval.ts", import.meta.url).pathname],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [out, err, code] = await Promise.all([
    new Response(job.stdout).text(),
    new Response(job.stderr).text(),
    job.exited,
  ]);
  expect({ code, err }).toEqual({ code: 0, err: "" });
  expect(out).toContain("Durable handoff");
});
