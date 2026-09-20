/** CI never migrates a local fallback. Prefer a direct URL over the app pool. */
export function migrationTarget(env: Record<string, string | undefined>) {
  const url = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;
  if (url) return { kind: "remote" as const, url };
  if ((env.CI && env.CI !== "false") || env.NODE_ENV === "production") {
    throw new Error(
      "Remote migration requires DATABASE_URL_UNPOOLED or DATABASE_URL; local fallback is disabled in CI/production.",
    );
  }
  return { kind: "local" as const };
}
