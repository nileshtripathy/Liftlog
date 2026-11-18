import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/server/env";

function createClient() {
  // DATABASE_URL should be Neon's POOLED endpoint; keep the per-instance pool small.
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL, max: 5 });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Singleton Prisma client (survives hot reloads in dev). */
export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
