import { timingSafeEqual } from "node:crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { SEED_USERS } from "@repo/db";

import { env } from "@/env";

/**
 * Preview-only sign-in, so a screenshot run can reach an authenticated screen
 * by URL alone.
 *
 * `before-and-after` drives `agent-browser`, which only ever takes a URL — there
 * is no hook to script a login. This route makes the signed-in state addressable:
 *
 *   /api/preview-login?key=<secret>&as=<seat>&next=/some/screen
 *
 * Behind Vercel Deployment Protection, add the automation bypass to the same URL
 * so the redirect that follows stays authorised:
 *
 *   &x-vercel-protection-bypass=<secret>&x-vercel-set-bypass-cookie=true
 *
 * ## This is a backdoor. It is safe only because of these:
 *
 * - 404s when `VERCEL_ENV` is production. Checked at runtime, not by config.
 * - 404s unless `PREVIEW_LOGIN_SECRET` is set and matches. Unset means off, so
 *   it stays off everywhere the variable was never added.
 * - Only signs in seeded users. Never a real person's account.
 * - Tokens expire in two minutes. A screenshot needs seconds.
 *
 * Never set `PREVIEW_LOGIN_SECRET` on the production environment.
 */

const TOKEN_TTL_SECONDS = 120;

function notFound() {
  return new Response(null, { status: 404 });
}

function secretMatches(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV === "production") return notFound();

  const secret = env.PREVIEW_LOGIN_SECRET;
  if (!secret) return notFound();

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key || !secretMatches(key, secret)) return notFound();

  const seat = url.searchParams.get("as") ?? "default";
  const userId = SEED_USERS[seat];
  if (!userId) {
    return new Response(`Unknown seat "${seat}". Add it to SEED_USERS.`, { status: 400 });
  }

  // Keep the redirect on this origin — an open redirect here would hand the
  // session to whoever supplied the URL.
  const next = url.searchParams.get("next") ?? "/";
  if (!next.startsWith("/") || next.startsWith("//")) {
    return new Response("next must be a path on this origin", { status: 400 });
  }

  // The SDK call is type-checked. The ticket is consumed by Clerk's sign-in
  // route as __clerk_ticket — verify that against a real preview once.
  const client = await clerkClient();
  const token = await client.signInTokens.createSignInToken({
    userId,
    expiresInSeconds: TOKEN_TTL_SECONDS,
  });

  const target = new URL("/sign-in", url.origin);
  target.searchParams.set("__clerk_ticket", token.token);
  target.searchParams.set("redirect_url", next);

  return Response.redirect(target, 302);
}
