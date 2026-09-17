import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth/config';

// Extend NextAuth types
declare module 'next-auth' {
  interface User {
    role?: string;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
  }
}

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
