import { resolve } from "node:path";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

const repoRoot = resolve(import.meta.dirname, "../..");

config({ path: resolve(repoRoot, "apps/web/.env.local") });
config({ path: resolve(repoRoot, "apps/web/.env") });
config({ path: resolve(import.meta.dirname, ".env.local") });
config({ path: resolve(import.meta.dirname, ".env") });
config({ path: resolve(repoRoot, ".env.local") });
config({ path: resolve(repoRoot, ".env") });

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

// `generate` only reads src/schema.ts — it never opens a connection. Requiring
// a URL for it is what forced Neon to exist before the first slice could run.
// `push` and `studio` do talk to Postgres, and PGlite is not reachable over the
// wire, so those still need Neon. Local migrations go through `db:migrate`.
const needsConnection = !process.argv.includes("generate");

if (!url && needsConnection) {
  throw new Error(
    "This drizzle-kit command talks to Postgres. Set DATABASE_URL_UNPOOLED (Neon direct, no -pooler) or DATABASE_URL.\n" +
      "Working locally? `bun run db generate` then `bun run db migrate` — the PGlite fallback needs no connection string.",
  );
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: url ?? "postgres://unused" },
});
