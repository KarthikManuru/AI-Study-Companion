'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface ProjectAnalytics {
  project: {
    id: string;
    name: string;
    goal: string;
    space: { id: string; name: string; color: string; icon: string };
  };
  summary: {
    totalMaterials: number;
    totalPages: number;
    totalConcepts: number;
    averageMastery: number;
    totalQuizzes: number;
    completedQuizzes: number;
    averageQuizScore: number;
    totalConversations: number;
    totalMessages: number;
    aiTokens: number;
    aiCost: number;
  };
  distribution: {
    mastered: any[];
    inProgress: any[];
    needsAttention: any[];
  };
  conceptMasteries: {
    id: string;
    name: string;
    score: number;
    trend: string;
    history: number[];
    lastEvidenceAt: string;
  }[];
  quizTimeline: {
    id: string;
    score: number;
    completedAt: string;
    questionCount: number;
  }[];
  aiUsage: {
    totalCalls: number;
    tokens: number;
    cost: number;
    callsByFeature: Record<string, number>;
    recentLogs: any[];
  };
  recentEvents: {
    id: string;
    type: string;
    payload: any;
    createdAt: string;
  }[];
}

export default function ProjectAnalyticsPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [data, setData] = useState<ProjectAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/projects/${projectId}/analytics`);
        if (res.ok) {
          const json = await res.json();
          setData(json.data);
        }
      } catch (err) {
        console.error('Failed to load project analytics:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading project analytics & telemetry...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Unable to load analytics for this project.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Breadcrumb & Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <Link href="/dashboard/spaces" className="hover:underline">Spaces</Link>
          <span>/</span>
          <Link href={`/dashboard/spaces/${data.project.space.id}`} className="hover:underline">
            {data.project.space.name}
          </Link>
          <span>/</span>
          <Link href={`/dashboard/projects/${projectId}`} className="hover:underline">
            {data.project.name}
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">Project Analytics</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2.5">
              <span>{data.project.name} — Learning Analytics</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Deep dive into concept retention, quiz trajectory, AI interactions, and study momentum for this project.
            </p>
          </div>
          <Link
            href={`/dashboard/projects/${projectId}`}
            className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition"
          >
            ← Back to Project
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase">Project Mastery</span>
          <div className="text-2xl font-extrabold text-primary mt-1">{data.summary.averageMastery}%</div>
          <span className="text-[10px] text-muted-foreground">across {data.summary.totalConcepts} concepts</span>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase">Quiz Average</span>
          <div className="text-2xl font-extrabold text-foreground mt-1">{data.summary.averageQuizScore}%</div>
          <span className="text-[10px] text-muted-foreground">{data.summary.completedQuizzes} completed</span>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase">Materials</span>
          <div className="text-2xl font-extrabold text-foreground mt-1">{data.summary.totalMaterials}</div>
          <span className="text-[10px] text-muted-foreground">{data.summary.totalPages} pages indexed</span>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase">Tutor Messages</span>
          <div className="text-2xl font-extrabold text-foreground mt-1">{data.summary.totalMessages}</div>
          <span className="text-[10px] text-muted-foreground">in {data.summary.totalConversations} sessions</span>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase">AI Token Cost</span>
          <div className="text-2xl font-extrabold text-purple-400 mt-1">${data.summary.aiCost}</div>
          <span className="text-[10px] text-muted-foreground">{data.summary.aiTokens.toLocaleString()} tokens</span>
        </div>
      </div>

      {/* Concept Mastery Breakdown & Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 p-6 rounded-2xl border border-border bg-card space-y-4">
          <h2 className="text-base font-semibold">Concept Mastery & Trend Tracking</h2>
          {data.conceptMasteries.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              No concepts evaluated yet. Upload materials and take a quiz to initialize mastery telemetry.
            </div>
          ) : (
            <div className="space-y-3">
              {data.conceptMasteries.map((cm) => (
                <div key={cm.id} className="p-3.5 rounded-xl border border-border bg-background space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">{cm.name}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                          cm.trend === 'IMPROVING'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : cm.trend === 'NEEDS_ATTENTION'
                            ? 'bg-amber-500/10 text-amber-500'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {cm.trend}
                      </span>
                      <span className="font-bold text-foreground">{cm.score}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        cm.score >= 80 ? 'bg-emerald-500' : cm.score >= 40 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${cm.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Distribution Summary */}
        <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
          <h2 className="text-base font-semibold">Mastery Tier Distribution</h2>
          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-between">
              <div>
                <div className="font-bold">Mastered (≥80%)</div>
                <div className="text-[11px] opacity-80">{data.distribution.mastered.length} concepts</div>
              </div>
              <span className="text-xl font-extrabold">{data.distribution.mastered.length}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-between">
              <div>
                <div className="font-bold">In Progress (40–79%)</div>
                <div className="text-[11px] opacity-80">{data.distribution.inProgress.length} concepts</div>
              </div>
              <span className="text-xl font-extrabold">{data.distribution.inProgress.length}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-between">
              <div>
                <div className="font-bold">Needs Attention (&lt;40%)</div>
                <div className="text-[11px] opacity-80">{data.distribution.needsAttention.length} concepts</div>
              </div>
              <span className="text-xl font-extrabold">{data.distribution.needsAttention.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quiz Trajectory Timeline */}
      {data.quizTimeline.length > 0 && (
        <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
          <h2 className="text-base font-semibold">Assessment Score Trajectory</h2>
          <div className="flex items-end gap-4 h-36 pt-4 overflow-x-auto pb-2">
            {data.quizTimeline.map((quiz, i) => (
              <div key={quiz.id} className="flex flex-col items-center gap-1.5 shrink-0 min-w-[50px]">
                <span className="text-[10px] font-bold text-muted-foreground">{quiz.score}%</span>
                <div className="w-8 bg-muted rounded-t-lg relative flex items-end h-24 overflow-hidden">
                  <div
                    className={`w-full transition-all rounded-t-lg ${
                      quiz.score >= 70 ? 'bg-primary' : 'bg-amber-500'
                    }`}
                    style={{ height: `${Math.max(10, quiz.score)}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">Q#{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Telemetry for this project */}
      <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
        <h2 className="text-base font-semibold">Project AI Telemetry Breakdown</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {Object.entries(data.aiUsage.callsByFeature).map(([feature, count]) => (
            <div key={feature} className="p-3 rounded-xl border border-border bg-background">
              <span className="text-muted-foreground block capitalize">{feature.replace('_', ' ')}</span>
              <span className="text-lg font-bold text-foreground mt-1 block">{count} requests</span>
            </div>
          ))}
        </div>
      </div>

      {/* Project Learning Event Stream */}
      <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
        <h2 className="text-base font-semibold">Project Activity Stream</h2>
        <div className="divide-y divide-border">
          {data.recentEvents.map((evt) => (
            <div key={evt.id} className="py-3 flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground mr-2">{evt.type}</span>
              <span className="text-muted-foreground text-[11px]">
                {new Date(evt.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
