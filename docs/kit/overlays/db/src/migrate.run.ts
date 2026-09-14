import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { config } from "dotenv";
import { drizzle as remoteDb } from "drizzle-orm/node-postgres";
import { migrate as remoteMigrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle as localDb } from "drizzle-orm/pglite";
import { migrate as localMigrate } from "drizzle-orm/pglite/migrator";
import { Pool } from "pg";
import { migrationTarget } from "./migration-target";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
// Match drizzle-kit selection locally; inherited CI credentials stay authoritative.
if (!process.env.CI || process.env.CI === "false") {
  const repoRoot = join(packageRoot, "../..");
  for (const directory of [join(repoRoot, "apps/web"), packageRoot, repoRoot]) {
    for (const file of [".env.local", ".env"]) config({ path: join(directory, file), quiet: true });
  }
}
const options = { migrationsFolder: join(packageRoot, "drizzle") };
const target = migrationTarget(process.env);
if (target.kind === "remote") {
  const pool = new Pool({ connectionString: target.url });
  try {
    await remoteMigrate(remoteDb({ client: pool }), options);
    console.log("migrated (remote Postgres)");
  } finally {
    await pool.end();
  }
} else {
  const client = new PGlite(join(packageRoot, ".pglite"));
  try {
    await localMigrate(localDb({ client }), options);
    console.log("migrated (local PGlite)");
  } finally {
    await client.close();
  }
}
