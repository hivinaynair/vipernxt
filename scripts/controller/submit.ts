import { read } from "../factory/core";

const environment = process.env;
const url = environment.FACTORY_URL,
  token = environment.FACTORY_CONTROL_TOKEN;
if (!url || !token || !process.argv[2] || !process.argv[3])
  throw new Error(
    "Set FACTORY_URL and FACTORY_CONTROL_TOKEN; run bun scripts/controller/submit.ts submission.json unique-key",
  );
if (new URL(url).protocol !== "https:" && new URL(url).hostname !== "localhost")
  throw new Error("Controller URL must use HTTPS");
const response = await fetch(`${url.replace(/\/$/, "")}/v1/batches`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Idempotency-Key": process.argv[3],
  },
  body: JSON.stringify(read(process.argv[2])),
  signal: AbortSignal.timeout(120000),
  redirect: "error",
});
if (!response.ok)
  throw new Error(`Registration failed (${response.status}); inspect controller status`);
console.log(await response.text());
