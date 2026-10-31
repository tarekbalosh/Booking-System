import { PrismaClient } from "@prisma/client";
import { getDatabaseUrl } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/**
 * Lazily constructs the client. Keeping construction lazy lets `next build`
 * succeed without a database connection, while every real query fails with a
 * clear message if DATABASE_URL is not configured.
 */
export function getDb(): PrismaClient {
  if (!globalForPrisma.prisma) {
    getDatabaseUrl();
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }
  return globalForPrisma.prisma;
}

export type Db = ReturnType<typeof getDb>;
