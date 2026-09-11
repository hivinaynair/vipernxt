import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://localhost:${PORT}`;
const webDir = path.join(import.meta.dirname, "../../apps/web");

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  outputDir: "test-results",
  timeout: 30_000,
  use: {
    baseURL,
    trace: "on",
    screenshot: "on",
  },
  webServer: {
    command: "bun run start",
    cwd: webDir,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
