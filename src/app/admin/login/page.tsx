'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Use our custom admin login API endpoint
      const res = await fetch('/api/admin-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid email or password');
        return;
      }

      // Success — redirect to admin dashboard with full page reload so cookies and session mount fresh
      window.location.href = '/admin';
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface bg-grid p-4">
      {/* Background gradient orbs — purple theme for admin */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-600/25 rounded-full blur-[100px]" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-600/20 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-fuchsia-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-600/10 border border-purple-500/20 mb-4">
            <span className="text-3xl">⚙️</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Console</h1>
          <p className="text-gray-400 mt-1">Sign in to access the admin dashboard</p>
          <span className="inline-block mt-2 text-[10px] font-bold px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase tracking-wider">
            Admin Access Only
          </span>
        </div>

        {/* Form */}
        <div className="glass-card p-8" style={{ borderColor: 'rgba(139, 92, 246, 0.15)' }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm animate-fade-in">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="admin-email" className="block text-sm font-medium text-gray-300 mb-2">
                Admin Email
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="admin@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200"
              style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.8), rgba(168, 85, 247, 0.8))',
                color: 'white',
                border: '1px solid rgba(139, 92, 246, 0.3)',
              }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Authenticating...
                </>
              ) : (
                <>
                  🔐 Sign In as Admin
                </>
              )}
            </button>

            {/* Quick Demo Credentials Fill Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setEmail('admin@example.com');
                  setPassword('admin1234');
                }}
                className="w-full text-xs text-purple-300/80 hover:text-purple-200 bg-purple-500/10 hover:bg-purple-500/15 border border-purple-500/20 rounded-lg py-2 transition flex items-center justify-center gap-1.5"
              >
                <span>⚡ Fill Demo Admin:</span>
                <code className="font-mono text-white/90">admin@example.com / admin1234</code>
              </button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-white/5 text-center space-y-3">
            <div className="text-sm text-gray-400">
              Need an admin account?{' '}
              <Link href="/admin/signup" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
                Register as Admin
              </Link>
            </div>
            <div className="text-xs text-gray-500">
              <Link href="/auth/login" className="text-gray-400 hover:text-gray-300 transition-colors">
                ← Back to Learner Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
