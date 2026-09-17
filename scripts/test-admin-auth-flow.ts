import { POST as signupHandler } from '../src/app/api/admin-auth/signup/route';
import { POST as loginHandler } from '../src/app/api/admin-auth/login/route';
import { GET as sessionHandler } from '../src/app/api/admin-auth/session/route';
import { NextRequest } from 'next/server';

async function testAdminFlow() {
  console.log('🧪 Testing Admin Signup & Login API Routes End-to-End...');

  // Test 1: Admin Signup with existing email (upgrading/resetting password)
  const signupReq = new NextRequest('http://localhost:3000/api/admin-auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Super Admin',
      email: 'admin@example.com',
      password: 'adminpassword123',
      adminSecret: process.env.ADMIN_SECRET_KEY || '',
    }),
  });

  const signupRes = await signupHandler(signupReq);
  const signupData = await signupRes.json();
  console.log('1. Admin Signup Response:', signupRes.status, signupData);

  if (signupRes.status !== 200 && signupRes.status !== 201) {
    throw new Error('Admin signup failed: ' + JSON.stringify(signupData));
  }

  const adminCookie = signupRes.cookies.get('next-auth.admin-session-token');
  console.log('✅ Admin cookie set on signup:', !!adminCookie?.value);

  // Test 2: Admin Login with the newly set password
  const loginReq = new NextRequest('http://localhost:3000/api/admin-auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@example.com',
      password: 'adminpassword123',
    }),
  });

  const loginRes = await loginHandler(loginReq);
  const loginData = await loginRes.json();
  console.log('2. Admin Login Response:', loginRes.status, loginData);

  if (loginRes.status !== 200) {
    throw new Error('Admin login failed: ' + JSON.stringify(loginData));
  }

  // Test 3: Session verification from cookie
  const sessionReq = new NextRequest('http://localhost:3000/api/admin-auth/session', {
    headers: {
      cookie: `next-auth.admin-session-token=${loginRes.cookies.get('next-auth.admin-session-token')?.value}`,
    },
  });

  const sessionRes = await sessionHandler(sessionReq);
  const sessionData = await sessionRes.json();
  console.log('3. Admin Session Verification:', sessionData);

  if (!sessionData?.user || sessionData.user.role !== 'ADMIN') {
    throw new Error('Admin session verification failed');
  }

  // Restore password to default admin1234 for consistency
  const restoreReq = new NextRequest('http://localhost:3000/api/admin-auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'admin1234',
      adminSecret: process.env.ADMIN_SECRET_KEY || '',
    }),
  });
  await signupHandler(restoreReq);
  console.log('✅ Restored admin@example.com password to admin1234');
  console.log('🎉 All Admin Signup & Login verification tests passed successfully!');
}

testAdminFlow().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
