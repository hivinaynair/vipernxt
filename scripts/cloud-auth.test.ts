import { describe, expect, test } from "bun:test";
import { authEnvironment } from "../docs/kit/overlays/auth/e2e/auth-env";

describe("cloud auth test configuration", () => {
  const valid = {
    CLERK_SECRET_KEY: "sk_test_fixture",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_fixture",
    E2E_BASE_URL: "https://staging.example.com",
  };
  test("accepts dedicated development configuration without changing it", () => {
    expect(authEnvironment(valid).baseURL).toBe(valid.E2E_BASE_URL);
  });
  test("rejects production keys and absent secrets", () => {
    for (const patch of [
      { CLERK_SECRET_KEY: "sk_live_secret" },
      { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_key" },
      { CLERK_SECRET_KEY: undefined },
    ]) {
      expect(() => authEnvironment({ ...valid, ...patch })).toThrow("development keys");
    }
  });
  test("rejects remote HTTP, URL credentials and query tokens", () => {
    for (const url of [
      "http://staging.example.com",
      "https://user:secret@example.com",
      "https://example.com?token=secret",
      "file:///tmp/app",
    ]) {
      expect(() => authEnvironment({ ...valid, E2E_BASE_URL: url })).toThrow();
    }
    expect(authEnvironment({ ...valid, E2E_BASE_URL: "http://localhost:3000" }).baseURL).toBe(
      "http://localhost:3000",
    );
  });
});
