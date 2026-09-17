'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface AnalyticsData {
  stats: {
    totalSpaces: number;
    totalProjects: number;
    totalMaterials: number;
    totalPages: number;
    totalQuizAttempts: number;
    completedQuizzes: number;
    averageQuizScore: number;
    averageMastery: number;
    totalConversations: number;
    totalMessages: number;
  };
  concepts: {
    totalTracked: number;
    strongConcepts: { name: string; score: number; trend: string; projectName: string }[];
    attentionConcepts: { name: string; score: number; trend: string; projectName: string }[];
    allMasteries: { name: string; score: number; trend: string; projectName: string }[];
  };
  quizScoreHistory: { date: string; score: number; projectName: string }[];
  activityFeed: {
    id: string;
    type: string;
    payload: any;
    createdAt: string;
    projectName: string;
    projectId?: string;
  }[];
}

const eventTypeIcons: Record<string, string> = {
  'quiz.completed': '📝',
  'quiz.started': '🎯',
  'material.uploaded': '📄',
  'material.processed': '✅',
  'tutor.interaction': '💬',
  'project.created': '📁',
  'space.created': '📚',
  'recommendation.generated': '💡',
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedFilter, setFeedFilter] = useState<string>('all');

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const res = await fetch('/api/analytics?limit=30');
        if (res.ok) {
          const json = await res.json();
          setData(json.data);
        }
      } catch (err) {
        console.error('Failed to load analytics data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header skeleton */}
        <div>
          <div className="shimmer h-4 w-32 mb-2" />
          <div className="shimmer h-8 w-64 mb-1" />
          <div className="shimmer h-4 w-96" />
        </div>
        {/* Stats cards skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="glass-card p-5">
              <div className="shimmer h-4 w-16 mb-3" />
              <div className="shimmer h-8 w-12 mb-1" />
              <div className="shimmer h-3 w-24" />
            </div>
          ))}
        </div>
        {/* Charts skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-6">
            <div className="shimmer h-5 w-40 mb-4" />
            <div className="shimmer h-40 rounded-xl" />
          </div>
          <div className="glass-card p-6">
            <div className="shimmer h-5 w-40 mb-4" />
            <div className="shimmer h-40 rounded-xl" />
          </div>
        </div>
        {/* Activity feed skeleton */}
        <div className="glass-card p-6">
          <div className="shimmer h-5 w-48 mb-4" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <div className="shimmer h-8 w-8 rounded-full" />
              <div className="flex-1">
                <div className="shimmer h-4 w-48 mb-1" />
                <div className="shimmer h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Unable to load analytics at this time.</p>
      </div>
    );
  }

  const filteredFeed = data.activityFeed.filter((evt) => {
    if (feedFilter === 'all') return true;
    if (feedFilter === 'quiz') return evt.type.startsWith('quiz.');
    if (feedFilter === 'tutor') return evt.type.startsWith('tutor.');
    if (feedFilter === 'material') return evt.type.startsWith('material.');
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <Link href="/dashboard" className="hover:underline">Dashboard</Link>
          <span>/</span>
          <span className="text-foreground">Analytics</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2.5">
          <span>Learning Analytics & Growth</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
            Real-time Telemetry
          </span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Holistic view of your retention, concept mastery, assessment performance, and study activity.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Average Mastery</div>
          <div className="text-3xl font-extrabold text-primary">{data.stats.averageMastery}%</div>
          <div className="text-xs text-muted-foreground">Across {data.concepts.totalTracked} active concepts</div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quiz Accuracy</div>
          <div className="text-3xl font-extrabold text-foreground">{data.stats.averageQuizScore}%</div>
          <div className="text-xs text-muted-foreground">{data.stats.completedQuizzes} completed attempts</div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Materials Processed</div>
          <div className="text-3xl font-extrabold text-foreground">{data.stats.totalMaterials}</div>
          <div className="text-xs text-muted-foreground">{data.stats.totalPages} pages embedded</div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tutor Sessions</div>
          <div className="text-3xl font-extrabold text-foreground">{data.stats.totalConversations}</div>
          <div className="text-xs text-muted-foreground">{data.stats.totalMessages} exchanged messages</div>
        </div>
      </div>

      {/* Concept Matrix: Strengths & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strong Concepts */}
        <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <span className="text-emerald-500">★</span>
              <span>Mastered Concepts (≥75%)</span>
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-bold">
              {data.concepts.strongConcepts.length} strong
            </span>
          </div>

          {data.concepts.strongConcepts.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              No concepts have reached 75% mastery yet. Keep quizzing!
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.concepts.strongConcepts.map((c, i) => (
                <div key={i} className="p-3 rounded-xl border border-border bg-background flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground">{c.name}</div>
                    <div className="text-[11px] text-muted-foreground">Project: {c.projectName}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
                      {c.score}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Needs Attention */}
        <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <span className="text-amber-500">⚡</span>
              <span>Needs Attention (&lt;50%)</span>
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-bold">
              {data.concepts.attentionConcepts.length} prioritized
            </span>
          </div>

          {data.concepts.attentionConcepts.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              All active concepts are progressing above 50%! Excellent work.
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.concepts.attentionConcepts.map((c, i) => (
                <div key={i} className="p-3 rounded-xl border border-border bg-background flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground">{c.name}</div>
                    <div className="text-[11px] text-muted-foreground">Project: {c.projectName}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
                      {c.score}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quiz Trend Chart / Timeline */}
      {data.quizScoreHistory.length > 0 && (
        <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
          <h2 className="text-base font-semibold">Quiz Performance Trend</h2>
          <div className="flex items-end gap-3 h-40 pt-4 overflow-x-auto pb-2">
            {data.quizScoreHistory.map((entry, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1.5 shrink-0 min-w-[50px] group">
                <div className="text-[10px] font-bold text-muted-foreground group-hover:text-foreground">
                  {entry.score}%
                </div>
                <div className="w-8 bg-muted rounded-t-lg relative flex items-end h-28 overflow-hidden">
                  <div
                    className={`w-full transition-all rounded-t-lg ${
                      entry.score >= 70 ? 'bg-primary' : 'bg-amber-500'
                    }`}
                    style={{ height: `${Math.max(10, entry.score)}%` }}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground truncate max-w-[55px] text-center" title={entry.projectName}>
                  {entry.date.slice(5)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Learning Event Activity Stream */}
      <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Activity Stream</h2>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5">
            {['all', 'quiz', 'tutor', 'material'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFeedFilter(f)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                  feedFilter === f
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {filteredFeed.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            No activity matches the selected filter.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredFeed.map((evt) => (
              <div key={evt.id} className="py-3.5 flex items-center justify-between text-xs gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg shrink-0">{eventTypeIcons[evt.type] || '📌'}</span>
                  <div className="min-w-0">
                    <span className="font-semibold text-foreground mr-2">
                      {evt.type.replace('.', ' ').toUpperCase()}
                    </span>
                    <span className="text-muted-foreground">in project</span>{' '}
                    <span className="text-foreground font-medium">{evt.projectName}</span>
                  </div>
                </div>

                <div className="text-muted-foreground shrink-0 text-[11px]">
                  {new Date(evt.createdAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
