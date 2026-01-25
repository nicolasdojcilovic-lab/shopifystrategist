/**
 * ⚠️ SINGLETON PRISMA CLIENT (SSOT)
 * 
 * Pattern recommandé par Prisma pour Next.js (App Router).
 * Évite la création de multiples instances de PrismaClient en dev (hot-reload).
 * 
 * Référence: https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
