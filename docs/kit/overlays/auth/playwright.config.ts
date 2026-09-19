import { defineConfig, devices } from "@playwright/test";
import { authEnvironment } from "./e2e/auth-env";

const { baseURL } = authEnvironment();
export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env.CI,
  retries: 0,
  use: { baseURL, trace: "off", video: "off", screenshot: "off" },
  projects: [
    { name: "setup", testMatch: /clerk\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testIgnore: /clerk\.setup\.ts/,
    },
  ],
});
