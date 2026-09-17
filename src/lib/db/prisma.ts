import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Eagerly establish the database connection to avoid cold-start latency
// on the first request. This pre-warms the connection pool.
prisma.$connect().catch((e: Error) => {
  console.error('Failed to pre-connect to database:', e.message);
});

export default prisma;
