import { expect, test } from "bun:test";

test("a reported registration hold stops SDK retries after its checkpoint and owner receipt", async () => {
  const job = Bun.spawn(
    [process.execPath, new URL("./fixtures/registration-hold.eval.ts", import.meta.url).pathname],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [out, err, code] = await Promise.all([
    new Response(job.stdout).text(),
    new Response(job.stderr).text(),
    job.exited,
  ]);
  expect({ code, err }).toEqual({ code: 0, err: "" });
  expect(out).toContain("Registration hold is fatal");
});
