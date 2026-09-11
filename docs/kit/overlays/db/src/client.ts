import "server-only";

import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

const globalForDb = globalThis as typeof globalThis & {
  pool?: Pool;
};

function getPool() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set (use the Neon pooled connection string).");
  }

  if (!globalForDb.pool) {
    const pool = new Pool({ connectionString: url });
    attachDatabasePool(pool);
    globalForDb.pool = pool;
  }

  return globalForDb.pool;
}

export const db = drizzle({ client: getPool(), schema });
