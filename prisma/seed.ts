import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo user (for local dev only)
  const demoPasswordHash = await bcrypt.hash('demo1234', 12);
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      passwordHash: demoPasswordHash,
      name: 'Demo User',
      role: 'USER',
    },
  });
  console.log(`✅ Demo user: ${demoUser.email} (password: demo1234)`);

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('admin1234', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash: adminPasswordHash,
      name: 'Admin User',
      role: 'ADMIN',
    },
  });
  console.log(`✅ Admin user: ${adminUser.email} (password: admin1234)`);

  console.log('\n🎉 Seeding complete!');
  console.log('──────────────────────────────────────');
  console.log('Demo login:  demo@example.com / demo1234');
  console.log('Admin login: admin@example.com / admin1234');
  console.log('──────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
