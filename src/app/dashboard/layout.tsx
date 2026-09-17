'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const navItems = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/dashboard/spaces', label: 'Spaces', icon: '📚' },
  { href: '/dashboard/analytics', label: 'Analytics', icon: '📊' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAdmin = (session?.user as any)?.role === 'ADMIN';

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-surface flex flex-col md:flex-row">
      {/* Mobile Top Navigation Bar */}
      <header className="md:hidden sticky top-0 z-30 bg-surface-raised/95 backdrop-blur-md border-b border-white/10 px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition"
            aria-label="Toggle navigation menu"
          >
            <span className="text-xl">{mobileMenuOpen ? '✕' : '☰'}</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-lg">🧠</span>
            <span className="text-sm font-bold text-white">AI Study Companion</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand-600/20 border border-brand-500/30 flex items-center justify-center">
            <span className="text-xs font-bold text-brand-400">
              {session?.user?.name?.charAt(0).toUpperCase() || '?'}
            </span>
          </div>
        </div>
      </header>

      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar (Drawer on mobile, fixed/responsive on desktop) */}
      <aside
        className={`fixed top-0 left-0 h-full z-50 bg-surface-raised border-r border-white/10 
                   flex flex-col transition-all duration-300 ease-in-out
                   ${mobileMenuOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'}
                   ${sidebarCollapsed ? 'md:w-20' : 'md:w-64'}`}
      >
        {/* Logo & Mobile Close */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600/10 border border-brand-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">🧠</span>
            </div>
            {(!sidebarCollapsed || mobileMenuOpen) && (
              <span className="text-sm font-bold text-white truncate">AI Study Companion</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                  ${
                    isActive
                      ? 'bg-brand-600/10 text-brand-400 border border-brand-500/20'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  }`}
                title={sidebarCollapsed && !mobileMenuOpen ? item.label : undefined}
              >
                <span className="text-lg flex-shrink-0">{item.icon}</span>
                {(!sidebarCollapsed || mobileMenuOpen) && <span>{item.label}</span>}
              </Link>
            );
          })}

          {isAdmin && (
            <>
              <div
                className={`px-3 pt-4 pb-2 ${
                  sidebarCollapsed && !mobileMenuOpen ? 'hidden' : ''
                }`}
              >
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Admin
                </span>
              </div>
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                  ${
                    pathname.startsWith('/admin')
                      ? 'bg-purple-600/10 text-purple-400 border border-purple-500/20'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  }`}
                title={sidebarCollapsed && !mobileMenuOpen ? 'Admin' : undefined}
              >
                <span className="text-lg flex-shrink-0">⚙️</span>
                {(!sidebarCollapsed || mobileMenuOpen) && <span>Admin Dashboard</span>}
              </Link>
            </>
          )}
        </nav>

        {/* User section */}
        <div className="px-3 py-4 border-t border-white/5">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex w-full items-center gap-3 px-3 py-2 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-all text-sm mb-2"
          >
            <span className="text-lg flex-shrink-0">{sidebarCollapsed ? '→' : '←'}</span>
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>

          <div
            className={`flex items-center gap-3 px-3 py-2 ${
              sidebarCollapsed && !mobileMenuOpen ? 'justify-center' : ''
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-brand-600/20 border border-brand-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-brand-400">
                {session?.user?.name?.charAt(0).toUpperCase() || '?'}
              </span>
            </div>
            {(!sidebarCollapsed || mobileMenuOpen) && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-200 truncate">{session?.user?.name}</p>
                <p className="text-xs text-gray-500 truncate">{session?.user?.email}</p>
              </div>
            )}
          </div>

          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/5 transition-all text-sm mt-1"
            title={sidebarCollapsed && !mobileMenuOpen ? 'Sign Out' : undefined}
          >
            <span className="text-lg flex-shrink-0">🚪</span>
            {(!sidebarCollapsed || mobileMenuOpen) && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main
        className={`flex-1 transition-all duration-300 w-full min-w-0 ${
          sidebarCollapsed ? 'md:ml-20' : 'md:ml-64'
        }`}
      >
        <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">{children}</div>
      </main>
    </div>
  );
}
