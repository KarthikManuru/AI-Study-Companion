'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Project {
  id: string;
  name: string;
  description: string;
  goal: string;
  updatedAt: string;
  _count: { materials: number; concepts: number; quizAttempts: number; conversations: number };
  conceptMasteries: { masteryScore: number; trend: string }[];
}

interface Space {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  _count: { projects: number };
  projects: Project[];
}

export default function SpaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const spaceId = params.spaceId as string;
  const [space, setSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState('');
  const [error, setError] = useState('');

  const fetchSpace = useCallback(async () => {
    try {
      const res = await fetch(`/api/spaces/${spaceId}`);
      const data = await res.json();
      if (data.success) setSpace(data.data);
      else router.push('/dashboard/spaces');
    } catch {
      router.push('/dashboard/spaces');
    } finally {
      setLoading(false);
    }
  }, [spaceId, router]);

  useEffect(() => { fetchSpace(); }, [fetchSpace]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      const res = await fetch(`/api/spaces/${spaceId}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, goal }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create project');
        return;
      }

      setShowCreate(false);
      setName('');
      setDescription('');
      setGoal('');
      fetchSpace();
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setCreating(false);
    }
  };

  const getAvgMastery = (masteries: { masteryScore: number }[]) => {
    if (masteries.length === 0) return 0;
    return Math.round(masteries.reduce((s, m) => s + m.masteryScore, 0) / masteries.length);
  };

  const getMasteryColor = (score: number) => {
    if (score >= 80) return 'bg-green-400';
    if (score >= 60) return 'bg-yellow-400';
    if (score >= 40) return 'bg-orange-400';
    return 'bg-red-400';
  };

  if (loading || !space) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="shimmer h-10 w-64" />
        <div className="shimmer h-24 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => <div key={i} className="shimmer h-48 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/dashboard/spaces" className="hover:text-gray-200 transition-colors">Spaces</Link>
        <span>→</span>
        <span className="text-gray-200">{space.name}</span>
      </div>

      {/* Space header */}
      <div className="glass-card p-8">
        <div className="flex items-center gap-5">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
            style={{ backgroundColor: `${space.color}15`, border: `1px solid ${space.color}30` }}
          >
            {space.icon}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white">{space.name}</h1>
            <p className="text-gray-400 mt-1">{space.description || 'No description'}</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            + New Project
          </button>
        </div>
      </div>

      {/* Create Project Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card p-8 w-full max-w-lg animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-6">Create New Project</h2>
            <form onSubmit={handleCreateProject} className="space-y-5">
              {error && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Project Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                  placeholder="e.g. Neural Networks Fundamentals"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-field resize-none h-20"
                  placeholder="What is this project about?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Learning Goal</label>
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="input-field resize-none h-24"
                  placeholder="What do you want to achieve? e.g. Understand backpropagation and be able to implement a basic neural network from scratch"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This helps the AI tutor and quiz system adapt to your objectives.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={creating} className="btn-primary flex-1">
                  {creating ? 'Creating...' : 'Create Project'}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Projects list */}
      {space.projects.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <span className="text-5xl mb-6 block">📁</span>
          <h2 className="text-2xl font-bold text-white mb-3">No projects yet</h2>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">
            Create your first project in this space to start uploading materials and learning.
          </p>
          <button onClick={() => setShowCreate(true)} className="btn-primary text-lg">
            Create First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {space.projects.map((project) => {
            const avgMastery = getAvgMastery(project.conceptMasteries);
            return (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.id}`}
                className="glass-card p-6 group hover:border-brand-500/20 transition-all duration-200 block"
              >
                <h3 className="font-semibold text-white group-hover:text-brand-300 transition-colors text-lg mb-2">
                  {project.name}
                </h3>
                <p className="text-sm text-gray-400 line-clamp-2 mb-4">
                  {project.description || project.goal || 'No description'}
                </p>

                {/* Mastery bar */}
                {project.conceptMasteries.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">Mastery</span>
                      <span className="text-xs font-medium text-gray-300">{avgMastery}%</span>
                    </div>
                    <div className="mastery-bar">
                      <div
                        className={`mastery-bar-fill ${getMasteryColor(avgMastery)}`}
                        style={{ width: `${avgMastery}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>📄 {project._count.materials} materials</span>
                  <span>🧠 {project._count.concepts} concepts</span>
                  <span>📝 {project._count.quizAttempts} quizzes</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
