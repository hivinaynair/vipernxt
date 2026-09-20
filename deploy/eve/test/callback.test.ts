import { expect, test } from "bun:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { handleCallback, verifyCallback } from "../agent/lib/callback.js";

const audience = "https://factory.example";
const { privateKey, publicKey } = await generateKeyPair("RS256");
const jwk = await exportJWK(publicKey);
jwk.kid = "test";
const keys = createLocalJWKSet({ keys: [jwk] });
async function token(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    cloud_agent_id: "bc-expected",
    iss: "https://api.cursor.com",
    aud: audience,
    iat: now,
    nbf: now - 5,
    exp: now + 300,
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .sign(privateKey);
}
test("accepts only signed, audience-bound identity for the registered agent", async () => {
  expect(await verifyCallback(await token(), audience, "bc-expected", keys)).toBe(true);
  expect(await verifyCallback(await token(), audience, "bc-other", keys)).toBe(false);
  for (const overrides of [
    { aud: "https://attacker.example" },
    { iss: "https://attacker.example" },
    { exp: 1 },
  ]) {
    await expect(
      verifyCallback(await token(overrides), audience, "bc-expected", keys),
    ).rejects.toThrow();
  }
});
test("unauthenticated and wrong-agent callbacks cannot wake execution", async () => {
  let wakes = 0;
  const deps = {
    active: async () => ({ agentId: "bc-expected", running: true }),
    verify: async () => false,
    resume: async () => {
      wakes++;
    },
  };
  expect((await handleCallback(new Request(audience), deps)).status).toBe(401);
  expect(
    (
      await handleCallback(
        new Request(audience, { headers: { Authorization: "Bearer bad" } }),
        deps,
      )
    ).status,
  ).toBe(403);
  expect(wakes).toBe(0);
});
test("callback carries no approval and cannot change the active agent", async () => {
  const wakes: string[] = [];
  const deps = {
    active: async () => ({ agentId: "bc-expected", running: true }),
    verify: async () => true,
    resume: async (id: string) => {
      wakes.push(id);
    },
  };
  const request = () =>
    new Request(audience, {
      method: "POST",
      headers: { Authorization: "Bearer valid" },
      body: JSON.stringify({ agentId: "evil", approved: true }),
    });
  expect((await handleCallback(request(), deps)).status).toBe(202);
  expect((await handleCallback(request(), deps)).status).toBe(202);
  expect(wakes).toEqual(["bc-expected", "bc-expected"]); // Same hook; no new dispatch.
});
test("failed wake is not acknowledged, inactive batch is not resumed", async () => {
  const req = () => new Request(audience, { headers: { Authorization: "Bearer valid" } });
  const deps = {
    active: async () => ({ agentId: "bc-expected", running: true }),
    verify: async () => true,
    resume: async () => {
      throw new Error("queue unavailable");
    },
  };
  expect((await handleCallback(req(), deps)).status).toBe(503);
  expect((await handleCallback(req(), { ...deps, active: async () => null })).status).toBe(204);
});
