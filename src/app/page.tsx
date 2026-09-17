import Link from 'next/link';
import { getAuthUser } from '@/lib/auth/helpers';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const user = await getAuthUser();
  if (user) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-surface bg-grid relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/10 rounded-full blur-[120px] animate-pulse-soft" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] animate-pulse-soft" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-700/5 rounded-full blur-[150px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600/10 border border-brand-500/20 flex items-center justify-center">
            <span className="text-xl">🧠</span>
          </div>
          <span className="text-lg font-bold text-white">AI Study Companion</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="btn-ghost">
            Sign In
          </Link>
          <Link href="/auth/signup" className="btn-primary">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10 max-w-5xl mx-auto px-8 pt-24 pb-32 text-center">
        <div className="animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-600/10 border border-brand-500/20 text-brand-400 text-sm font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse-soft" />
            AI-Powered Learning
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight tracking-tight mb-6">
            <span className="text-white">Learn Smarter with</span>
            <br />
            <span className="text-gradient">Your AI Companion</span>
          </h1>

          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
            Upload your study materials, learn with an AI tutor that cites your sources,
            take adaptive quizzes, track mastery, and get personalized recommendations
            — all in one intelligent workspace.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/signup" className="btn-primary text-lg px-8 py-3.5">
              Start Learning Free →
            </Link>
            <Link href="/auth/login" className="btn-secondary text-lg px-8 py-3.5">
              Sign In
            </Link>
          </div>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          {[
            {
              icon: '📚',
              title: 'Upload & Process',
              desc: 'Upload PDFs and let AI extract knowledge, concepts, and searchable content automatically.',
            },
            {
              icon: '💬',
              title: 'AI Tutor',
              desc: 'Ask questions and get answers grounded in your materials with source citations.',
            },
            {
              icon: '📊',
              title: 'Track & Grow',
              desc: 'Adaptive quizzes, concept mastery tracking, growth analysis, and smart recommendations.',
            },
          ].map((feature) => (
            <div key={feature.title} className="glass-card p-8 text-left group hover:border-brand-500/20 transition-all duration-300">
              <div className="text-3xl mb-4">{feature.icon}</div>
              <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-brand-300 transition-colors">
                {feature.title}
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* Learning loop visual */}
        <div className="mt-24 glass-card p-10 animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <h2 className="text-2xl font-bold text-white mb-6">The Complete Learning Loop</h2>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
            {[
              'Create Space',
              'Create Project',
              'Upload Material',
              'AI Processing',
              'Learn with Tutor',
              'Take Quiz',
              'Track Mastery',
              'View Growth',
              'Get Recommendations',
              'Continue Learning',
            ].map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                <span className="px-4 py-2 rounded-xl bg-brand-600/10 border border-brand-500/20 text-brand-300 font-medium whitespace-nowrap">
                  {step}
                </span>
                {i < 9 && <span className="text-brand-500">→</span>}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-8 text-gray-500 text-sm border-t border-white/5">
        Built with Next.js, PostgreSQL, pgvector, and Claude AI
      </footer>
    </div>
  );
}
