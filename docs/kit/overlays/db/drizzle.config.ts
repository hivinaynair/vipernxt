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

if (!url) {
  throw new Error(
    "Set DATABASE_URL_UNPOOLED (Neon direct, no -pooler) or DATABASE_URL for drizzle-kit.",
  );
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
});
