import { clerk } from "@clerk/testing/playwright";
import type { Page } from "@playwright/test";
import { authEnvironment } from "./auth-env";

/** Call in a fresh Playwright context per actor; never persist session state. */
export async function signInAs(page: Page, identityVariable: string) {
  authEnvironment();
  if (!/^E2E_CLERK_[A-Z0-9_]+_EMAIL$/.test(identityVariable)) {
    throw new Error("Use a declared E2E_CLERK_<ROLE>_EMAIL runtime secret.");
  }
  const emailAddress = process.env[identityVariable];
  if (!emailAddress) throw new Error(`Missing runtime secret: ${identityVariable}`);
  // The product must expose /sign-in with ClerkProvider before this helper runs.
  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress });
}
