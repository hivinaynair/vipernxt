import "server-only";
import { PostHog } from "posthog-node";
import { env } from "@/env";

let client: PostHog | null | undefined;

export function getPostHogServer(): PostHog | null {
  if (client !== undefined) return client;
  const token = env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) {
    client = null;
    return client;
  }
  client = new PostHog(token, {
    host: env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
  return client;
}
