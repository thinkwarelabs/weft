// Prisma 7 CLI configuration.
//
// `import "dotenv/config"` loads .env so the Prisma CLI (migrate/studio/db) can
// read the connection string. The RUNTIME client does not use this file — it
// connects through a driver adapter (see src/lib/db.ts) using the same env var.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations need a direct/session connection (port 5432), NOT the
    // transaction pooler (6543) — DDL and advisory locks don't survive
    // transaction pooling. Runtime uses DATABASE_URL (pooled); the CLI uses
    // DIRECT_URL when present.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
