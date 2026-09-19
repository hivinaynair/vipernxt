import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..");
if (!existsSync(join(repoRoot, "packages/db/package.json"))) {
  console.error("No packages/db yet. On the site clone: bun scripts/scaffold.mjs --add db --apply");
  process.exit(1);
}

const commands = {
  generate: "db:generate",
  migrate: "db:migrate",
  push: "db:push",
  studio: "db:studio",
  seed: "db:seed",
};

/**
 * PGlite is single-connection and keeps a lock in its data directory. Killing
 * `next dev` uncleanly can leave that directory unopenable, and the failure
 * surfaces as `RuntimeError: Aborted()` from the wasm build with no hint about
 * the cause. The data is a seed, so throwing it away and rebuilding is the
 * right fix — but nobody would guess it from that error.
 */
if (process.argv[2] === "reset") {
  const dir = join(repoRoot, "packages/db/.pglite");
  if (process.env.DATABASE_URL) {
    console.error(
      "DATABASE_URL is set — reset only ever touches the local PGlite fallback, never a real database.",
    );
    process.exit(1);
  }
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
    console.log(`removed ${dir}`);
  }
  const rebuild = Bun.spawn(["bun", "scripts/db.mjs", "seed"], {
    cwd: repoRoot,
    stdout: "inherit",
    stderr: "inherit",
  });
  process.exit(await rebuild.exited);
}

const command = process.argv[2];
const task = command ? commands[command] : undefined;

if (!task) {
  console.error("Usage: bun run db <generate|migrate|push|studio|seed|reset>");
  console.error("  reset — throw away the local PGlite data and rebuild it from the seed");
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
