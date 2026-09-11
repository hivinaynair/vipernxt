import { existsSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..");
if (!existsSync(join(repoRoot, "packages/db/package.json"))) {
  console.error("No packages/db yet. On the site clone: bun scripts/compose.mjs --add db --apply");
  process.exit(1);
}

const commands = {
  generate: "db:generate",
  migrate: "db:migrate",
  push: "db:push",
  studio: "db:studio",
  seed: "db:seed",
};

const command = process.argv[2];
const task = command ? commands[command] : undefined;

if (!task) {
  console.error("Usage: bun run db <generate|migrate|push|studio|seed>");
  process.exit(1);
}

const proc = Bun.spawn(
  ["bunx", "turbo", "run", task, "--filter=@repo/db", ...process.argv.slice(3)],
  {
    cwd: join(import.meta.dir, ".."),
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  },
);

process.exit(await proc.exited);
