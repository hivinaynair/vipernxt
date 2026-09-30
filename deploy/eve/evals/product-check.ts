/** Offline product evaluator. Copied and hash-pinned into the simulation checkout. */

import { spawn } from "node:child_process";
import { chromium, expect } from "@playwright/test";

const kind = process.argv[2] ?? "combined";
const deployed = process.argv.includes("--deployed");
const url = deployed ? process.env.FACTORY_STAGING_URL : "http://127.0.0.1:3190";
if (!url) throw new Error("Missing approved staging URL");
const server = deployed
  ? undefined
  : spawn("bun", ["run", "--cwd", "apps/web", "dev", "--hostname", "127.0.0.1", "--port", "3190"], {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  if (server) {
    let ready = false;
    for (let n = 0; n < 200; n++) {
      try {
        if ((await fetch(url)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await Bun.sleep(100);
    }
    if (!ready) throw new Error("Local product failed to start");
  }
  // Trust only the ephemeral simulation certificate, not arbitrary invalid certificates.
  const pin = deployed ? process.env.FACTORY_CERT_SPKI : undefined;
  if (deployed && !pin) throw new Error("Missing simulation certificate pin");
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
    headless: true,
    args: pin ? [`--ignore-certificate-errors-spki-list=${pin}`] : [],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  if (
    deployed &&
    response?.headers()["x-factory-candidate"] !== process.env.FACTORY_EXPECTED_COMMIT
  )
    throw new Error("Site does not serve the exact candidate");
  if (kind !== "detail") {
    await expect(page.getByText("6 missing POD · 10 cases")).toBeVisible();
    const rows = page.getByTestId("shipment-row");
    await expect(rows).toHaveCount(10);
    for (let i = 0; i < 6; i++) await expect(rows.nth(i)).toContainText("needs-pod");
    for (let i = 6; i < 10; i++) await expect(rows.nth(i)).toContainText("ready");
    await page.reload();
    await expect(rows).toHaveCount(10);
  }
  if (kind !== "queue") {
    if (kind === "combined") await page.getByRole("link", { name: "CF-003 · INV-003" }).click();
    else await page.goto(`${url}/shipments/CF-003`);
    await expect(page.getByRole("heading", { name: "INV-003" })).toBeVisible();
    await expect(page.getByText("Exception: split-delivery")).toBeVisible();
    await expect(page.getByText("POD: missing", { exact: true })).toBeVisible();
    await expect(page.locator("main button, main input, main form")).toHaveCount(0);
    const missing = await page.goto(`${url}/shipments/CF-999`);
    if (missing?.status() !== 404)
      throw new Error(`Unknown Shipment returned ${missing?.status()}`);
  }
  console.log(
    JSON.stringify({
      actualBrowser: true,
      kind,
      url,
      candidate: process.env.FACTORY_EXPECTED_COMMIT,
      checks: "queue/order/reload, invoice/exception, read-only, genuine 404",
    }),
  );
} finally {
  await browser?.close();
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {}
  }
}
