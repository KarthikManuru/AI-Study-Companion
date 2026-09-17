'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface ProjectData {
  id: string;
  name: string;
  description: string;
  goal: string;
  space: { id: string; name: string; color: string; icon: string };
  materials: { id: string; fileName: string; status: string; pageCount: number | null; createdAt: string }[];
  concepts: { id: string; name: string; description: string }[];
  conceptMasteries: { id: string; masteryScore: number; trend: string; concept: { name: string } }[];
  recommendations: { id: string; text: string; reason: string; status: string }[];
  recentActivity: { id: string; type: string; payload: any; createdAt: string }[];
  _count: { materials: number; concepts: number; quizAttempts: number; conversations: number };
  overallProgress: number;
}

const eventLabels: Record<string, string> = {
  'material.uploaded': '📄 Material uploaded',
  'material.processed': '✅ Material ready',
  'tutor.interaction': '💬 Tutor session',
  'quiz.completed': '📝 Quiz completed',
  'quiz.started': '🎯 Quiz started',
  'project.created': '📁 Project created',
  'recommendation.generated': '💡 Recommendation',
};

export default function ProjectDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'materials' | 'tutor' | 'quiz' | 'mastery' | 'analytics'>('overview');

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      const data = await res.json();
      if (data.success) setProject(data.data);
      else router.push('/dashboard');
    } catch {
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [projectId, router]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  const getMasteryColor = (score: number) => {
    if (score >= 80) return 'bg-green-400';
    if (score >= 60) return 'bg-yellow-400';
    if (score >= 40) return 'bg-orange-400';
    return 'bg-red-400';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'IMPROVING': return '📈';
      case 'STABLE': return '➡️';
      case 'NEEDS_ATTENTION': return '⚠️';
      default: return '➡️';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'READY': return <span className="badge-success">Ready</span>;
      case 'PROCESSING': return <span className="badge-info">Processing</span>;
      case 'QUEUED': return <span className="badge-warning">Queued</span>;
      case 'FAILED': return <span className="badge-danger">Failed</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  if (loading || !project) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="shimmer h-10 w-96" />
        <div className="shimmer h-32 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="shimmer h-24 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: '🏠' },
    { id: 'materials' as const, label: 'Materials', icon: '📄' },
    { id: 'tutor' as const, label: 'AI Tutor', icon: '💬' },
    { id: 'quiz' as const, label: 'Quiz', icon: '📝' },
    { id: 'mastery' as const, label: 'Mastery', icon: '🎯' },
    { id: 'analytics' as const, label: 'Analytics', icon: '📊' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/dashboard/spaces" className="hover:text-gray-200 transition-colors">Spaces</Link>
        <span>→</span>
        <Link href={`/dashboard/spaces/${project.space.id}`} className="hover:text-gray-200 transition-colors">
          {project.space.name}
        </Link>
        <span>→</span>
        <span className="text-gray-200">{project.name}</span>
      </div>

      {/* Project header */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
            style={{ backgroundColor: `${project.space.color}15`, border: `1px solid ${project.space.color}30` }}
          >
            {project.space.icon}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{project.name}</h1>
            {project.goal && <p className="text-sm text-gray-400 mt-1">🎯 {project.goal}</p>}
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-white">{project.overallProgress}%</p>
            <p className="text-xs text-gray-500">Overall Mastery</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 mastery-bar h-3">
          <div
            className={`mastery-bar-fill ${getMasteryColor(project.overallProgress)}`}
            style={{ width: `${project.overallProgress}%` }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface-raised/50 rounded-xl border border-white/5 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              if (tab.id === 'tutor') {
                router.push(`/dashboard/projects/${projectId}/tutor`);
              } else if (tab.id === 'quiz') {
                router.push(`/dashboard/projects/${projectId}/quiz`);
              } else {
                setActiveTab(tab.id);
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap
              ${activeTab === tab.id
                ? 'bg-brand-600/10 text-brand-400 border border-brand-500/20'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stats */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Materials', value: project._count.materials, icon: '📄' },
                { label: 'Concepts', value: project._count.concepts, icon: '🧠' },
                { label: 'Quizzes', value: project._count.quizAttempts, icon: '📝' },
                { label: 'Conversations', value: project._count.conversations, icon: '💬' },
              ].map((s) => (
                <div key={s.label} className="glass-card p-4 text-center">
                  <span className="text-2xl">{s.icon}</span>
                  <p className="text-2xl font-bold text-white mt-1">{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Top concepts by mastery */}
            {project.conceptMasteries.length > 0 && (
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Concept Mastery</h3>
                <div className="space-y-3">
                  {project.conceptMasteries.slice(0, 8).map((m) => (
                    <div key={m.id} className="flex items-center gap-3">
                      <span className="text-sm">{getTrendIcon(m.trend)}</span>
                      <span className="text-sm text-gray-200 w-40 truncate">{m.concept.name}</span>
                      <div className="flex-1 mastery-bar">
                        <div
                          className={`mastery-bar-fill ${getMasteryColor(m.masteryScore)}`}
                          style={{ width: `${m.masteryScore}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-300 w-12 text-right">
                        {Math.round(m.masteryScore)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Activity */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
              {project.recentActivity.length === 0 ? (
                <p className="text-gray-400 text-sm">No activity yet. Start by uploading materials or talking to the AI tutor.</p>
              ) : (
                <div className="space-y-2">
                  {project.recentActivity.map((event) => (
                    <div key={event.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
                      <span className="text-sm">{eventLabels[event.type]?.split(' ')[0] || '📌'}</span>
                      <span className="text-sm text-gray-300 flex-1">
                        {eventLabels[event.type]?.split(' ').slice(1).join(' ') || event.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(event.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick actions */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Link
                  href={`/dashboard/projects/${projectId}/tutor`}
                  className="btn-primary w-full flex items-center gap-2 justify-center"
                >
                  💬 Ask AI Tutor
                </Link>
                <Link
                  href={`/dashboard/projects/${projectId}/quiz`}
                  className="btn-secondary w-full flex items-center gap-2 justify-center"
                >
                  📝 Take Quiz
                </Link>
              </div>
            </div>

            {/* Recommendations */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">💡 Recommendations</h3>
              {project.recommendations.length === 0 ? (
                <p className="text-sm text-gray-400">
                  Complete learning activities to receive personalized recommendations.
                </p>
              ) : (
                <div className="space-y-3">
                  {project.recommendations.map((rec) => (
                    <div key={rec.id} className="p-3 bg-brand-600/5 rounded-xl border border-brand-500/10">
                      <p className="text-sm text-gray-200">{rec.text}</p>
                      <p className="text-xs text-gray-500 mt-1">{rec.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Materials status */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">📄 Materials</h3>
                <button
                  onClick={() => setActiveTab('materials')}
                  className="text-xs text-brand-400 hover:text-brand-300"
                >
                  View All
                </button>
              </div>
              {project.materials.length === 0 ? (
                <p className="text-sm text-gray-400">No materials uploaded yet.</p>
              ) : (
                <div className="space-y-2">
                  {project.materials.slice(0, 5).map((mat) => (
                    <div key={mat.id} className="flex items-center gap-2">
                      <span className="text-sm text-gray-300 truncate flex-1">{mat.fileName}</span>
                      {getStatusBadge(mat.status)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'materials' && (
        <MaterialsTab projectId={projectId} materials={project.materials} onRefresh={fetchProject} />
      )}

      {activeTab === 'mastery' && (
        <MasteryTab masteries={project.conceptMasteries} overallProgress={project.overallProgress} />
      )}

      {activeTab === 'analytics' && (
        <AnalyticsTab projectId={projectId} project={project} />
      )}
    </div>
  );
}

// ─── Materials Tab ────────────────────────────────────────

function MaterialsTab({ projectId, materials, onRefresh }: {
  projectId: string;
  materials: ProjectData['materials'];
  onRefresh: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Poll for status changes
  useEffect(() => {
    const hasProcessing = materials.some((m) => m.status === 'QUEUED' || m.status === 'PROCESSING');
    if (!hasProcessing) return;

    const interval = setInterval(onRefresh, 3000);
    return () => clearInterval(interval);
  }, [materials, onRefresh]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setUploadError('Only PDF files are supported');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setUploadError('File size must be under 50MB');
      return;
    }

    setUploadError('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', projectId);

      const res = await fetch('/api/materials/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error || 'Upload failed');
        return;
      }

      onRefresh();
    } catch {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'READY': return <span className="badge-success">Ready</span>;
      case 'PROCESSING': return <span className="badge-info flex items-center gap-1"><span className="status-dot-processing" /> Processing</span>;
      case 'QUEUED': return <span className="badge-warning">Queued</span>;
      case 'FAILED': return <span className="badge-danger">Failed</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <div className="glass-card p-8">
        <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-brand-500/30 transition-colors">
          <input
            type="file"
            accept=".pdf"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <span className="text-4xl block mb-3">{uploading ? '⏳' : '📤'}</span>
            <p className="text-lg font-medium text-white mb-1">
              {uploading ? 'Uploading...' : 'Upload PDF Material'}
            </p>
            <p className="text-sm text-gray-400">
              Click to select a PDF file (max 50MB)
            </p>
          </label>
        </div>
        {uploadError && (
          <div className="mt-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {uploadError}
          </div>
        )}
      </div>

      {/* Materials list */}
      {materials.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          No materials uploaded yet. Upload a PDF to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {materials.map((mat) => (
            <div key={mat.id} className="glass-card p-4 flex items-center gap-4">
              <span className="text-2xl">📄</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-200 truncate">{mat.fileName}</p>
                <p className="text-xs text-gray-500">
                  {mat.pageCount ? `${mat.pageCount} pages • ` : ''}
                  {new Date(mat.createdAt).toLocaleDateString()}
                </p>
              </div>
              {getStatusBadge(mat.status)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Mastery Tab ──────────────────────────────────────────

function MasteryTab({ masteries, overallProgress }: {
  masteries: ProjectData['conceptMasteries'];
  overallProgress: number;
}) {
  const getMasteryColor = (score: number) => {
    if (score >= 80) return 'bg-green-400';
    if (score >= 60) return 'bg-yellow-400';
    if (score >= 40) return 'bg-orange-400';
    return 'bg-red-400';
  };

  const getTrendLabel = (trend: string) => {
    switch (trend) {
      case 'IMPROVING': return { icon: '📈', label: 'Improving', color: 'text-green-400' };
      case 'STABLE': return { icon: '➡️', label: 'Stable', color: 'text-gray-400' };
      case 'NEEDS_ATTENTION': return { icon: '⚠️', label: 'Needs Attention', color: 'text-yellow-400' };
      default: return { icon: '➡️', label: 'Unknown', color: 'text-gray-400' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Overall progress */}
      <div className="glass-card p-8 text-center">
        <p className="text-6xl font-bold text-white mb-2">{overallProgress}%</p>
        <p className="text-gray-400">Overall Mastery</p>
        <div className="mt-4 max-w-md mx-auto mastery-bar h-3">
          <div className={`mastery-bar-fill ${getMasteryColor(overallProgress)}`} style={{ width: `${overallProgress}%` }} />
        </div>
      </div>

      {masteries.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <span className="text-4xl block mb-3">🎯</span>
          <p className="text-gray-400">No concept mastery data yet. Upload materials and take quizzes to track your progress.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {masteries.map((m) => {
            const trend = getTrendLabel(m.trend);
            return (
              <div key={m.id} className="glass-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-white">{m.concept.name}</h4>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${trend.color} flex items-center gap-1`}>
                      {trend.icon} {trend.label}
                    </span>
                    <span className="text-lg font-bold text-white">{Math.round(m.masteryScore)}%</span>
                  </div>
                </div>
                <div className="mastery-bar">
                  <div className={`mastery-bar-fill ${getMasteryColor(m.masteryScore)}`} style={{ width: `${m.masteryScore}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────

function AnalyticsTab({ projectId, project }: { projectId: string; project: ProjectData }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Learning Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Total Materials</span>
              <span className="text-gray-200">{project._count.materials}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Concepts Tracked</span>
              <span className="text-gray-200">{project._count.concepts}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Quiz Attempts</span>
              <span className="text-gray-200">{project._count.quizAttempts}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Tutor Conversations</span>
              <span className="text-gray-200">{project._count.conversations}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Overall Mastery</span>
              <span className="text-gray-200">{project.overallProgress}%</span>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Mastery Distribution</h3>
          {project.conceptMasteries.length === 0 ? (
            <p className="text-sm text-gray-400">No mastery data yet.</p>
          ) : (
            <div className="space-y-2">
              {[
                { label: 'Mastered (80-100%)', min: 80, max: 100, color: 'bg-green-400' },
                { label: 'Progressing (60-79%)', min: 60, max: 79, color: 'bg-yellow-400' },
                { label: 'Learning (40-59%)', min: 40, max: 59, color: 'bg-orange-400' },
                { label: 'Needs Work (0-39%)', min: 0, max: 39, color: 'bg-red-400' },
              ].map((tier) => {
                const count = project.conceptMasteries.filter(
                  (m) => m.masteryScore >= tier.min && m.masteryScore <= tier.max
                ).length;
                const pct = project.conceptMasteries.length > 0
                  ? Math.round((count / project.conceptMasteries.length) * 100)
                  : 0;
                return (
                  <div key={tier.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">{tier.label}</span>
                      <span className="text-gray-300">{count} ({pct}%)</span>
                    </div>
                    <div className="mastery-bar">
                      <div className={`mastery-bar-fill ${tier.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Activity Timeline</h3>
        {project.recentActivity.length === 0 ? (
          <p className="text-sm text-gray-400">No activity recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {project.recentActivity.map((event) => (
              <div key={event.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                <span className="text-sm">{eventLabels[event.type]?.split(' ')[0] || '📌'}</span>
                <span className="text-sm text-gray-300 flex-1">
                  {eventLabels[event.type]?.split(' ').slice(1).join(' ') || event.type}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(event.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
