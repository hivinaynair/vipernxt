import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from "jose";

const keys = createRemoteJWKSet(new URL("https://api.cursor.com/keys"));
export async function verifyCallback(
  token: string,
  audience: string,
  agentId: string,
  getKey: JWTVerifyGetKey = keys,
) {
  const { payload } = await jwtVerify(token, getKey, {
    issuer: "https://api.cursor.com",
    audience,
    algorithms: ["RS256"],
    requiredClaims: ["exp", "iat", "nbf", "cloud_agent_id"],
    clockTolerance: 5,
    maxTokenAge: "5m",
  });
  return payload.cloud_agent_id === agentId;
}

type CallbackDependencies = {
  active(): Promise<{ agentId: string; running: boolean } | null>;
  verify(token: string, agentId: string): Promise<boolean>;
  resume(agentId: string): Promise<void>;
};
export async function handleCallback(request: Request, deps: CallbackDependencies) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ") || authorization.length > 16384)
    return new Response(null, { status: 401 });
  const active = await deps.active();
  if (!active?.running) return new Response(null, { status: 204 });
  try {
    if (!(await deps.verify(authorization.slice(7), active.agentId)))
      return new Response(null, { status: 403 });
  } catch {
    return new Response(null, { status: 401 });
  }
  try {
    // Wake only. Acceptance remains in the workflow's API/diff/check gates.
    await deps.resume(active.agentId);
    return new Response(null, { status: 202 });
  } catch {
    // Do not acknowledge an unpersisted wake. Hook retries, then the durable
    // run deadline reconciles a lost callback.
    return new Response(null, { status: 503 });
  }
}
