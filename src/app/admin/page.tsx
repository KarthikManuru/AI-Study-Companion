'use client';

import { useState, useEffect } from 'react';

interface AdminData {
  platformStats: {
    totalUsers: number;
    totalSpaces: number;
    totalProjects: number;
    totalMaterials: number;
    totalQuizzes: number;
  };
  aiUsage: {
    totalCalls: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    totalCostUsd: number;
    avgLatencyMs: number;
    featureBreakdown: Record<string, { calls: number; cost: number; tokens: number }>;
    recentLogs: {
      id: string;
      feature: string;
      model: string;
      promptTokens: number;
      completionTokens: number;
      latencyMs: number;
      costUsd: number;
      success: boolean;
      errorMessage?: string;
      createdAt: string;
    }[];
  };
  evals: {
    totalRuns: number;
    passRate: number;
    results: {
      id: string;
      feature: string;
      testCaseId: string;
      passed: boolean;
      score?: number;
      notes?: string;
      createdAt: string;
    }[];
  };
  users: {
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: string;
    _count: {
      spaces: number;
      conversations: number;
      learningEvents: number;
    };
  }[];
  recentEvents: {
    id: string;
    type: string;
    payload: any;
    createdAt: string;
    userEmail: string;
    projectName: string;
  }[];
}

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'ai' | 'evals' | 'jobs'>('overview');
  const [userSearch, setUserSearch] = useState('');
  const [jobData, setJobData] = useState<any>(null);

  useEffect(() => {
    async function loadJobs() {
      if (activeTab === 'jobs' && !jobData) {
        try {
          const res = await fetch('/api/admin/jobs');
          if (res.ok) {
            const json = await res.json();
            setJobData(json.data);
          }
        } catch (e) {
          console.error('Failed to load job metrics', e);
        }
      }
    }
    loadJobs();
  }, [activeTab, jobData]);

  useEffect(() => {
    async function loadAdminData() {
      try {
        const res = await fetch('/api/admin/overview');
        if (res.ok) {
          const json = await res.json();
          setData(json.data);
        }
      } catch (err) {
        console.error('Failed to load admin data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAdminData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Gathering system-wide telemetry...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Failed to load admin dashboard or unauthorized.</p>
      </div>
    );
  }

  const filteredUsers = data.users.filter(
    (u) =>
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.name?.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Title & Navigation Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Admin Telemetry & Operations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            System performance, LLM observability logs, user governance, and evaluation suites.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-card border border-border overflow-x-auto max-w-full">
          {[
            { id: 'overview', label: 'Platform Overview' },
            { id: 'users', label: 'Users' },
            { id: 'ai', label: 'AI Observability' },
            { id: 'evals', label: 'Eval Harness' },
            { id: 'jobs', label: 'Job Health' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition flex-shrink-0 ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Banner */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase">Users</div>
          <div className="text-2xl font-extrabold text-foreground mt-0.5">{data.platformStats.totalUsers}</div>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase">Spaces</div>
          <div className="text-2xl font-extrabold text-foreground mt-0.5">{data.platformStats.totalSpaces}</div>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase">Projects</div>
          <div className="text-2xl font-extrabold text-foreground mt-0.5">{data.platformStats.totalProjects}</div>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase">Materials</div>
          <div className="text-2xl font-extrabold text-foreground mt-0.5">{data.platformStats.totalMaterials}</div>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase">Quizzes</div>
          <div className="text-2xl font-extrabold text-foreground mt-0.5">{data.platformStats.totalQuizzes}</div>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase">AI Spend</div>
          <div className="text-2xl font-extrabold text-purple-400 mt-0.5">${data.aiUsage.totalCostUsd}</div>
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* AI Metrics summary */}
          <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
            <h2 className="text-base font-semibold">AI Gateway Telemetry</h2>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-background border border-border">
                <span className="text-muted-foreground block">Total Tokens Billed</span>
                <span className="text-lg font-bold text-foreground mt-1 block">
                  {data.aiUsage.totalTokens.toLocaleString()}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Prompt: {data.aiUsage.totalPromptTokens.toLocaleString()} • Completion: {data.aiUsage.totalCompletionTokens.toLocaleString()}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-background border border-border">
                <span className="text-muted-foreground block">Average Latency</span>
                <span className="text-lg font-bold text-foreground mt-1 block">
                  {data.aiUsage.avgLatencyMs} ms
                </span>
                <span className="text-[10px] text-muted-foreground">Across all LLM calls</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                Calls by Feature
              </h3>
              {Object.entries(data.aiUsage.featureBreakdown).map(([feature, stat]) => (
                <div key={feature} className="p-3 rounded-xl border border-border bg-background flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground uppercase tracking-wide">
                    {feature.replace('_', ' ')}
                  </span>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span>{stat.calls} calls</span>
                    <span>{stat.tokens.toLocaleString()} tokens</span>
                    <span className="font-bold text-purple-400">${stat.cost.toFixed(4)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Learning Events */}
          <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
            <h2 className="text-base font-semibold">Global System Activity Log</h2>
            <div className="divide-y divide-border max-h-[380px] overflow-y-auto pr-1">
              {data.recentEvents.map((evt) => (
                <div key={evt.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-foreground mr-1.5">
                      {evt.type}
                    </span>
                    <span className="text-muted-foreground">by {evt.userEmail}</span>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Project: {evt.projectName}
                    </div>
                  </div>
                  <span className="text-muted-foreground text-[11px]">
                    {new Date(evt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-base font-semibold">Registered Learners & Administrators</h2>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="px-3.5 py-1.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500 w-full sm:w-64"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground uppercase tracking-wider">
                  <th className="py-3 px-3">User</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Spaces</th>
                  <th className="py-3 px-3">Conversations</th>
                  <th className="py-3 px-3">Events</th>
                  <th className="py-3 px-3">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-accent/40 transition">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-foreground">{u.name || 'Anonymous'}</div>
                      <div className="text-muted-foreground text-[11px]">{u.email}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          u.role === 'ADMIN'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : 'bg-secondary text-secondary-foreground'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-foreground">{u._count.spaces}</td>
                    <td className="py-3 px-3 font-medium text-foreground">{u._count.conversations}</td>
                    <td className="py-3 px-3 font-medium text-foreground">{u._count.learningEvents}</td>
                    <td className="py-3 px-3 text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: AI OBSERVABILITY */}
      {activeTab === 'ai' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
            <h2 className="text-base font-semibold">Live AI Gateway Request Log</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-3">Feature</th>
                    <th className="py-3 px-3">Model</th>
                    <th className="py-3 px-3">Prompt Tokens</th>
                    <th className="py-3 px-3">Completion Tokens</th>
                    <th className="py-3 px-3">Latency</th>
                    <th className="py-3 px-3">Est. Cost</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.aiUsage.recentLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-accent/40 transition">
                      <td className="py-3 px-3 font-semibold text-foreground uppercase tracking-wide">
                        {log.feature}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">{log.model}</td>
                      <td className="py-3 px-3 font-medium text-foreground">{log.promptTokens}</td>
                      <td className="py-3 px-3 font-medium text-foreground">{log.completionTokens}</td>
                      <td className="py-3 px-3 text-muted-foreground">{log.latencyMs} ms</td>
                      <td className="py-3 px-3 font-bold text-purple-400">${log.costUsd.toFixed(4)}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            log.success
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-destructive/10 text-destructive'
                          }`}
                        >
                          {log.success ? 'SUCCESS' : 'FAILED'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: EVALS */}
      {activeTab === 'evals' && (
        <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Automated AI Evaluation Benchmarks</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Evaluation assertions verify factual grounding, citation accuracy, and prompt injection resilience.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                Total Benchmark Runs: <strong>{data.evals.totalRuns}</strong>
              </span>
              <span className="text-xs px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold">
                Pass Rate: {data.evals.passRate}%
              </span>
            </div>
          </div>

          {data.evals.results.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground space-y-2">
              <p>No evaluation runs recorded in the database yet.</p>
              <p className="text-xs">Run <code className="bg-muted px-2 py-1 rounded">npm run eval</code> to populate automated quality metrics.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-3">Feature</th>
                    <th className="py-3 px-3">Test Case ID</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Score</th>
                    <th className="py-3 px-3">Observations / Notes</th>
                    <th className="py-3 px-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.evals.results.map((ev) => (
                    <tr key={ev.id} className="hover:bg-accent/40 transition">
                      <td className="py-3 px-3 font-semibold text-foreground uppercase">{ev.feature}</td>
                      <td className="py-3 px-3 font-mono text-muted-foreground">{ev.testCaseId}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            ev.passed
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-destructive/10 text-destructive'
                          }`}
                        >
                          {ev.passed ? 'PASSED' : 'FAILED'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-medium text-foreground">{ev.score ?? '—'}</td>
                      <td className="py-3 px-3 text-muted-foreground">{ev.notes || '—'}</td>
                      <td className="py-3 px-3 text-muted-foreground">
                        {new Date(ev.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: JOB HEALTH */}
      {activeTab === 'jobs' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">BullMQ Background Queue Health</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Real-time queue depth, worker concurrency, and failure status across material processing & learning pipelines.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    jobData?.redisConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span className="text-xs font-semibold">
                  {jobData?.redisConnected ? 'Redis Connected' : 'Redis Standby / Disconnected'}
                </span>
              </div>
            </div>

            {/* Queue Metrics Cards */}
            {jobData?.queues && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Material Processing Queue */}
                <div className="p-4 rounded-xl border border-border bg-background space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">material-processing</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      Concurrency: {jobData.queues.materialProcessing.concurrencyLimit}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 rounded bg-card border border-border">
                      <div className="font-bold text-foreground">
                        {jobData.queues.materialProcessing.counts.waiting}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Waiting</div>
                    </div>
                    <div className="p-2 rounded bg-card border border-border">
                      <div className="font-bold text-purple-400">
                        {jobData.queues.materialProcessing.counts.active}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Active</div>
                    </div>
                    <div className="p-2 rounded bg-card border border-border">
                      <div className="font-bold text-emerald-500">
                        {jobData.queues.materialProcessing.counts.completed}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Done</div>
                    </div>
                    <div className="p-2 rounded bg-card border border-border">
                      <div className="font-bold text-destructive">
                        {jobData.queues.materialProcessing.counts.failed}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Failed</div>
                    </div>
                  </div>
                </div>

                {/* Learning Workflows Queue */}
                <div className="p-4 rounded-xl border border-border bg-background space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">learning-workflows</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      Concurrency: {jobData.queues.learningWorkflows.concurrencyLimit}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 rounded bg-card border border-border">
                      <div className="font-bold text-foreground">
                        {jobData.queues.learningWorkflows.counts.waiting}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Waiting</div>
                    </div>
                    <div className="p-2 rounded bg-card border border-border">
                      <div className="font-bold text-purple-400">
                        {jobData.queues.learningWorkflows.counts.active}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Active</div>
                    </div>
                    <div className="p-2 rounded bg-card border border-border">
                      <div className="font-bold text-emerald-500">
                        {jobData.queues.learningWorkflows.counts.completed}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Done</div>
                    </div>
                    <div className="p-2 rounded bg-card border border-border">
                      <div className="font-bold text-destructive">
                        {jobData.queues.learningWorkflows.counts.failed}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Failed</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Failed Jobs Table */}
            <div className="pt-4 space-y-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                Recent Failed Jobs & Error Reasons
              </h3>
              {!jobData?.recentFailedJobs || jobData.recentFailedJobs.length === 0 ? (
                <div className="text-xs text-muted-foreground py-4 text-center">
                  No failed jobs recorded. Queue is operating cleanly.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground uppercase">
                        <th className="py-2 px-2">Job ID</th>
                        <th className="py-2 px-2">Queue</th>
                        <th className="py-2 px-2">Action</th>
                        <th className="py-2 px-2">Attempts</th>
                        <th className="py-2 px-2">Failure Reason</th>
                        <th className="py-2 px-2">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {jobData.recentFailedJobs.map((j: any) => (
                        <tr key={j.id} className="hover:bg-accent/40">
                          <td className="py-2 px-2 font-mono text-[11px]">{j.id}</td>
                          <td className="py-2 px-2">{j.queue}</td>
                          <td className="py-2 px-2 font-semibold">{j.name}</td>
                          <td className="py-2 px-2">
                            {j.attemptsMade} / {j.maxAttempts}
                          </td>
                          <td className="py-2 px-2 text-destructive">{j.failedReason}</td>
                          <td className="py-2 px-2 text-muted-foreground">
                            {new Date(j.timestamp).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
