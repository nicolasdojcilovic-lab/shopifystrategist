/**
 * ⚠️ SINGLETON PRISMA CLIENT (SSOT)
 *
 * Pattern recommandé par Prisma pour Next.js (App Router).
 * Évite la création de multiples instances de PrismaClient en dev (hot-reload).
 *
 * DATABASE_URL: Must point to PostgreSQL (e.g. Supabase).
 * If using Supabase and connection fails: check in the Dashboard that the project
 * is not **Paused** (Project Settings → General). Paused projects refuse connections.
 *
 * Référence: https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function formatConnectionError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const hint =
    process.env.DATABASE_URL?.includes('supabase')
      ? ' If using Supabase, check in the Dashboard that the project is not **Paused** (Project Settings → General).'
      : '';
  return `[ShopifyStrategist] Database connection failed. Verify DATABASE_URL in .env.${hint} Original error: ${msg}`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Call at app/script startup to fail fast with a clear message if the DB is unreachable.
 * On failure, logs: DATABASE_URL check + Supabase "project Paused" hint when applicable.
 */
export async function ensureDatabaseConnection(): Promise<void> {
  try {
    await prisma.$connect();
  } catch (err) {
    console.error(formatConnectionError(err));
    throw err;
  }
}

export default prisma;
