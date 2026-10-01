import { expect, test } from "bun:test";

test("owner notification retries use durable sleeps and project exhausted delivery to GitHub", async () => {
  const job = Bun.spawn(
    [process.execPath, new URL("./fixtures/owner-delivery.eval.ts", import.meta.url).pathname],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [out, err, code] = await Promise.all([
    new Response(job.stdout).text(),
    new Response(job.stderr).text(),
    job.exited,
  ]);
  expect({ code, err }).toEqual({ code: 0, err: "" });
  expect(out).toContain("Owner delivery uses durable waits");
});
