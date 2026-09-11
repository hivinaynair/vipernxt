/**
 * Applies `drizzle/` to whichever database `client.ts` picked.
 *
 * drizzle-kit talks to Postgres over the wire, so it cannot reach the PGlite
 * fallback. Run generate (offline, schema only) then this.
 */
import { migrate as migrateNeon } from "drizzle-orm/node-postgres/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { db, usingDevDatabase } from "./client";

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const folder = join(dirname(fileURLToPath(import.meta.url)), "..", "drizzle");

// biome-ignore lint/suspicious/noExplicitAny: one migrator per driver, same folder.
const run = usingDevDatabase ? (migratePglite as any) : (migrateNeon as any);
await run(db, { migrationsFolder: folder });

console.log(usingDevDatabase ? "migrated (local PGlite)" : "migrated (Neon)");

// See seed.run.ts: the driver holds the event loop open.
process.exit(0);
