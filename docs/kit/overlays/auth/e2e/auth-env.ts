/** Test-runner configuration, never imported by application code. */
export function authEnvironment(source: Record<string, string | undefined> = process.env) {
  const secretKey = source.CLERK_SECRET_KEY;
  const publishableKey = source.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!secretKey?.startsWith("sk_test_") || !publishableKey?.startsWith("pk_test_")) {
    throw new Error("Browser verification requires Clerk development keys in runtime secrets.");
  }
  const baseURL = source.E2E_BASE_URL;
  if (!baseURL)
    throw new Error("Set E2E_BASE_URL to the approved test deployment or local server.");
  const url = new URL(baseURL);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))
    )
  ) {
    throw new Error(
      "E2E_BASE_URL must be HTTPS or local HTTP, without credentials/query/fragment.",
    );
  }
  return { secretKey, publishableKey, baseURL };
}
