import { getAuthUser } from '@/lib/auth/helpers';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import Link from 'next/link';

export default async function DashboardPage() {
  const user = await getAuthUser();
  if (!user) redirect('/auth/login');

  // Fetch all dashboard data in parallel to minimize latency
  // (each Neon query has ~500-700ms network overhead; sequential = 3s+, parallel = ~700ms)
  const [spaces, recentEvents, recommendations] = await Promise.all([
    prisma.space.findMany({
      where: { userId: user.id },
      include: {
        projects: {
          select: { id: true, name: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
          take: 3,
        },
        _count: { select: { projects: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.learningEvent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        project: { select: { name: true } },
      },
    }),
    prisma.recommendation.findMany({
      where: {
        project: { space: { userId: user.id } },
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: {
        project: { select: { name: true } },
      },
    }),
  ]);

  // Compute aggregate stats (second batch, depends on spaces result)
  const projectIds = spaces.flatMap((s) => s.projects.map((p) => p.id));
  
  const [masteryStats, quizCount, materialCount] = await Promise.all([
    projectIds.length > 0
      ? prisma.conceptMastery.aggregate({
          where: { projectId: { in: projectIds } },
          _avg: { masteryScore: true },
          _count: true,
        })
      : Promise.resolve({ _avg: { masteryScore: null }, _count: 0 }),
    prisma.quizAttempt.count({
      where: { projectId: { in: projectIds } },
    }),
    prisma.material.count({
      where: { projectId: { in: projectIds }, status: 'READY' },
    }),
  ]);

  const avgMastery = masteryStats._avg.masteryScore
    ? Math.round(masteryStats._avg.masteryScore)
    : 0;

  const eventTypeLabels: Record<string, string> = {
    'material.uploaded': '📄 Uploaded material',
    'material.processed': '✅ Material processed',
    'tutor.interaction': '💬 Tutor conversation',
    'quiz.completed': '📝 Quiz completed',
    'quiz.started': '🎯 Quiz started',
    'project.created': '📁 Created project',
    'space.created': '📚 Created space',
    'recommendation.generated': '💡 New recommendation',
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          Welcome back, {user.name.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-400 mt-1">
          Here&apos;s your learning overview — pick up where you left off.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Spaces', value: spaces.length, icon: '📚', color: 'brand' },
          { label: 'Materials', value: materialCount, icon: '📄', color: 'blue' },
          { label: 'Quizzes Taken', value: quizCount, icon: '📝', color: 'purple' },
          { label: 'Avg Mastery', value: `${avgMastery}%`, icon: '🎯', color: 'green' },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{stat.icon}</span>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{stat.label}</span>
            </div>
            <p className="text-3xl font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Spaces & Projects */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Your Spaces</h2>
            <Link href="/dashboard/spaces" className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
              View All →
            </Link>
          </div>

          {spaces.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <span className="text-4xl mb-4 block">📚</span>
              <h3 className="text-lg font-semibold text-white mb-2">No spaces yet</h3>
              <p className="text-gray-400 text-sm mb-6">Create your first learning space to get started.</p>
              <Link href="/dashboard/spaces" className="btn-primary">
                Create Space
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {spaces.map((space) => (
                <Link
                  key={space.id}
                  href={`/dashboard/spaces/${space.id}`}
                  className="glass-card p-5 block group hover:border-brand-500/20 transition-all duration-200"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ backgroundColor: `${space.color}15`, border: `1px solid ${space.color}30` }}
                    >
                      {space.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white group-hover:text-brand-300 transition-colors truncate">
                        {space.name}
                      </h3>
                      <p className="text-sm text-gray-400 truncate">{space.description || 'No description'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-medium text-gray-300">{space._count.projects}</p>
                      <p className="text-xs text-gray-500">projects</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Recommendations */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">💡 Recommendations</h2>
            {recommendations.length === 0 ? (
              <div className="glass-card p-5 text-center">
                <p className="text-sm text-gray-400">
                  Complete some learning activities to get personalized recommendations.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {recommendations.map((rec) => (
                  <div key={rec.id} className="glass-card p-4">
                    <p className="text-sm text-gray-200 mb-1">{rec.text}</p>
                    <p className="text-xs text-gray-500">{rec.project.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">📋 Recent Activity</h2>
            {recentEvents.length === 0 ? (
              <div className="glass-card p-5 text-center">
                <p className="text-sm text-gray-400">No activity yet. Start learning!</p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentEvents.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
                    <span className="text-sm flex-shrink-0 mt-0.5">
                      {eventTypeLabels[event.type]?.split(' ')[0] || '📌'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-300 truncate">
                        {eventTypeLabels[event.type]?.split(' ').slice(1).join(' ') || event.type}
                      </p>
                      {event.project && (
                        <p className="text-xs text-gray-500 truncate">{event.project.name}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-600 flex-shrink-0 ml-auto">
                      {new Date(event.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
