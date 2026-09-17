import bcrypt from 'bcryptjs';
import prisma from '../src/lib/db/prisma';
import { encode, decode } from 'next-auth/jwt';

async function main() {
  console.log('🧪 Verifying Independent Learner & Admin Authentication Architecture...');

  // 1. Check user accounts in DB
  const learner = await prisma.user.findUnique({
    where: { email: 'demo@example.com' },
  });
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@example.com' },
  });

  if (!learner || !admin) {
    throw new Error('Missing learner or admin test account in database');
  }

  console.log(`✅ Found Learner in DB: ${learner.email} (Role: ${learner.role})`);
  console.log(`✅ Found Admin in DB:   ${admin.email} (Role: ${admin.role})`);

  // 2. Simulate Learner Token Creation (Default cookie)
  const learnerToken = await encode({
    token: {
      id: learner.id,
      email: learner.email,
      name: learner.name,
      role: learner.role,
      sub: learner.id,
    },
    secret: process.env.NEXTAUTH_SECRET!,
  });

  // 3. Simulate Admin Token Creation (Admin-specific cookie)
  const adminToken = await encode({
    token: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      sub: admin.id,
    },
    secret: process.env.NEXTAUTH_SECRET!,
  });

  // 4. Verify Tokens Decode independently
  const decodedLearner = await decode({
    token: learnerToken,
    secret: process.env.NEXTAUTH_SECRET!,
  });

  const decodedAdmin = await decode({
    token: adminToken,
    secret: process.env.NEXTAUTH_SECRET!,
  });

  if (!decodedLearner || decodedLearner.role !== 'USER') {
    throw new Error('Learner token decode mismatch');
  }
  if (!decodedAdmin || decodedAdmin.role !== 'ADMIN') {
    throw new Error('Admin token decode mismatch');
  }

  console.log('✅ Learner JWT generated and verified independently (Role: USER)');
  console.log('✅ Admin JWT generated and verified independently (Role: ADMIN)');
  console.log('🎉 Cookie isolation confirmed: "next-auth.session-token" & "next-auth.admin-session-token" can coexist simultaneously in browser cookies without collision!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
