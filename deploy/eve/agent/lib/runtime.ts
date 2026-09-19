export const runtimeFiles = [
  ".cursor/hooks.json",
  ".cursor/hooks/factory-stop.mjs",
  ".cursor/factory.json",
  ".cursor/environment.json",
  ".cursor/Dockerfile",
];
type File = { text: string; sha: string };
export async function verifyRuntime(
  specFiles: string[],
  base: string,
  defaultBranch: string,
  audience: string,
  read: (path: string, ref: string) => Promise<File>,
) {
  if (runtimeFiles.some((path) => !specFiles.includes(path)))
    throw new Error("Cursor runtime and hook files must be pinned in specFiles");
  const approved: Record<string, File> = {};
  for (const path of runtimeFiles) {
    approved[path] = await read(path, base);
    if (approved[path].sha !== (await read(path, defaultBranch)).sha) {
      throw new Error(
        `Cursor default-branch runtime differs from approved worker base: ${path}. Refresh the environment Build before dispatch.`,
      );
    }
  }
  const callback = JSON.parse(approved[".cursor/factory.json"].text);
  if (callback.callbackUrl !== `${audience}/callbacks/cursor`)
    throw new Error("Product callback URL differs from this deployment");
  const hooks = JSON.parse(approved[".cursor/hooks.json"].text);
  if (
    hooks.version !== 1 ||
    !hooks.hooks?.stop?.some(
      (hook: { command?: string }) => hook.command === "node .cursor/hooks/factory-stop.mjs",
    )
  )
    throw new Error("Cursor stop hook is not installed");
  const environment = JSON.parse(approved[".cursor/environment.json"].text);
  if (
    environment.build?.dockerfile !== "Dockerfile" ||
    typeof environment.install !== "string" ||
    !environment.install.trim()
  )
    throw new Error("Cursor environment must declare the pinned Dockerfile and install command");
}
