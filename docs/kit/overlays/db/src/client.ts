import "server-only";

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { attachDatabasePool } from "@vercel/functions";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";

/**
 * Two drivers, chosen by whether DATABASE_URL is set.
 *
 * Set — Neon over node-postgres. This is the deployed path and the only one
 * that runs in production.
 *
 * Unset — PGlite, real Postgres compiled to WASM, writing to `.pglite/` beside
 * this package. It needs no daemon, no Docker and no provisioning, which is
 * what lets the first slice run and be looked at before anyone has accepted
 * the clip. It is single-connection: it is a development convenience, not a
 * staging environment.
 */
/**
 * Tables are imported from `@<scope>/db` directly, not hung off `db.schema`.
 * drizzle 1.x builds its relational API from `defineRelations`, not from a raw
 * schema module — pass `relations` here if a product adds them.
 */
const globalForDb = globalThis as typeof globalThis & {
  pool?: Pool;
  devDb?: ReturnType<typeof drizzlePglite>;
};

/**
 * Where the dev fallback keeps its data. Gitignored; safe to delete.
 *
 * Built with fileURLToPath rather than `new URL(..., import.meta.url)`:
 * Turbopack reads that form as an asset reference and fails the build trying
 * to resolve a directory that does not exist until first run.
 */
export const DEV_DB_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", ".pglite");

/** True when this process is running on the fallback rather than Neon. */
export const usingDevDatabase = !process.env.DATABASE_URL;

function neon(url: string) {
  if (!globalForDb.pool) {
    const pool = new Pool({ connectionString: url });
    attachDatabasePool(pool);
    globalForDb.pool = pool;
  }
  return drizzleNeon({ client: globalForDb.pool });
}

function local() {
  // Never in production. Falling back there would serve an empty ephemeral
  // database from a missing env var instead of failing the deploy.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_URL is not set. The PGlite fallback is development only — set the Neon pooled connection string.",
    );
  }
  globalForDb.devDb ??= drizzlePglite(DEV_DB_DIR);
  return globalForDb.devDb;
}

const url = process.env.DATABASE_URL;

/**
 * The two drivers build identical queries; only their connection differs.
 * Typed as the Neon one so feature code has a single type to reason about.
 */
export const db = (url ? neon(url) : local()) as unknown as NodePgDatabase;
