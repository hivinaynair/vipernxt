/** An adopted workflow must never compete with its predecessor's hook token. */
export function wakeToken(
  kind: "cursor" | "ci" | "deployment" | "retry",
  identity: string,
  owner?: string,
) {
  return `${kind}:${identity}${owner ? `:${owner}` : ""}`;
}

export function hookConflict(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "HookConflictError"
  );
}
