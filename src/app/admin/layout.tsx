'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminAuthPage = pathname === '/admin/login' || pathname === '/admin/signup';

  const [user, setUser] = useState<AdminUser | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>(
    isAdminAuthPage ? 'unauthenticated' : 'loading'
  );

  useEffect(() => {
    // If on admin login or signup, no session verification needed inside layout
    if (isAdminAuthPage) {
      return;
    }

    let isMounted = true;

    async function verifyAdminSession() {
      try {
        const res = await fetch('/api/admin-auth/session', { cache: 'no-store' });
        const data = await res.json();

        if (!isMounted) return;

        if (data?.user?.email && data?.user?.role === 'ADMIN') {
          setUser(data.user as AdminUser);
          setStatus('authenticated');
        } else {
          setUser(null);
          setStatus('unauthenticated');
          window.location.href = '/admin/login';
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Failed to verify admin session:', err);
        setUser(null);
        setStatus('unauthenticated');
        window.location.href = '/admin/login';
      }
    }

    verifyAdminSession();

    return () => {
      isMounted = false;
    };
  }, [pathname, isAdminAuthPage]);

  // If on login or signup pages, directly render children without the admin dashboard header
  if (isAdminAuthPage) {
    return <>{children}</>;
  }

  // Loading state while checking session
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        <span className="text-xs text-gray-400 font-medium">Verifying Admin Access...</span>
      </div>
    );
  }

  if (status === 'unauthenticated' || !user) {
    return null;
  }

  const handleSignOut = async () => {
    try {
      await fetch('/api/admin-auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Error logging out of admin:', e);
    }
    window.location.href = '/admin/login';
  };

  return (
    <div className="min-h-screen bg-surface text-foreground flex flex-col">
      {/* Admin Top Header */}
      <header className="border-b border-white/10 bg-surface-raised/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 min-h-[4rem] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <Link
              href="/dashboard"
              className="text-xs text-gray-400 hover:text-white px-2.5 py-1 rounded-lg border border-white/10 transition flex items-center gap-1.5"
            >
              <span>←</span>
              <span className="hidden sm:inline">Learner Dashboard</span>
              <span className="sm:hidden">Learner</span>
            </Link>
            <div className="hidden sm:block h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="text-xl">⚙️</span>
              <span className="font-bold text-sm tracking-wide text-white">Admin Console</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                SUPERADMIN
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 text-xs text-gray-400 ml-auto">
            <span className="hidden md:inline">
              Signed in as: <strong className="text-white">{user.email}</strong>
            </span>
            <button
              onClick={handleSignOut}
              className="text-xs text-purple-400 hover:text-purple-300 underline cursor-pointer font-medium"
            >
              Sign Out (Admin)
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}
