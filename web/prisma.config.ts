import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 reads connection settings from here, not from schema.prisma.
 * Migrations should use a DIRECT (non-pooled) connection; the runtime client
 * (src/server/db.ts) uses the pooled DATABASE_URL via the pg driver adapter.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
