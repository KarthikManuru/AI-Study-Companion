import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Migrating chunks table vector dimension to 768 in Neon...');
  // Truncate existing chunks to ensure dimension change can apply cleanly
  await prisma.$executeRawUnsafe('TRUNCATE TABLE chunks CASCADE;');
  await prisma.$executeRawUnsafe('ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(768);');
  console.log('Successfully altered chunks.embedding to vector(768) in Neon!');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
