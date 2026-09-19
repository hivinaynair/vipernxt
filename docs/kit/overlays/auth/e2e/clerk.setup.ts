import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";
import { authEnvironment } from "./auth-env";

setup("Clerk testing token", async () => {
  const { secretKey, publishableKey } = authEnvironment();
  await clerkSetup({ secretKey, publishableKey });
});
