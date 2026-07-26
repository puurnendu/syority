// Prisma config. DATABASE_URL comes from the environment (Docker/Compose/CI).
// Optionally load .env for local CLI when the dotenv package is available —
// do not hard-fail if it is absent (production migrator injects env vars).
import { createRequire } from "node:module";
import { defineConfig } from "prisma/config";

try {
  createRequire(import.meta.url)("dotenv/config");
} catch {
  // dotenv is a devDependency; not required when DATABASE_URL is already set
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
