'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Space {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  _count: { projects: number };
  projects: { id: string; name: string; updatedAt: string }[];
}

export default function SpacesPage() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('📚');
  const [color, setColor] = useState('#4c6ef5');
  const [error, setError] = useState('');

  const fetchSpaces = useCallback(async () => {
    try {
      const res = await fetch('/api/spaces');
      const data = await res.json();
      if (data.success) setSpaces(data.data);
    } catch {
      console.error('Failed to fetch spaces');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSpaces(); }, [fetchSpaces]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      const res = await fetch('/api/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, icon, color }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create space');
        return;
      }

      setShowCreate(false);
      setName('');
      setDescription('');
      setIcon('📚');
      setColor('#4c6ef5');
      fetchSpaces();
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setCreating(false);
    }
  };

  const icons = ['📚', '💻', '🧪', '🎨', '🎵', '📐', '🌍', '💡', '🔬', '📖', '🧠', '🎯', '⚡', '🏗️', '📈'];
  const colors = ['#4c6ef5', '#7950f2', '#e64980', '#40c057', '#fab005', '#228be6', '#12b886', '#fd7e14'];

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="shimmer h-8 w-48" />
          <div className="shimmer h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="shimmer h-40 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Spaces</h1>
          <p className="text-gray-400 mt-1">Organize your learning into spaces</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          + New Space
        </button>
      </div>

      {/* Create Space Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card p-8 w-full max-w-lg animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-6">Create New Space</h2>
            <form onSubmit={handleCreate} className="space-y-5">
              {error && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {icons.map((i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setIcon(i)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all
                        ${icon === i ? 'bg-brand-600/20 border-2 border-brand-500 scale-110' : 'bg-surface-overlay border border-white/10 hover:border-white/20'}`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Color</label>
                <div className="flex gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-full transition-all ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-surface scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                  placeholder="e.g. Machine Learning, Web Development"
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
                  placeholder="What will you learn in this space?"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={creating} className="btn-primary flex-1">
                  {creating ? 'Creating...' : 'Create Space'}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Spaces Grid */}
      {spaces.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <span className="text-5xl mb-6 block">📚</span>
          <h2 className="text-2xl font-bold text-white mb-3">No spaces yet</h2>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">
            Create your first learning space to organize your projects and start learning with AI.
          </p>
          <button onClick={() => setShowCreate(true)} className="btn-primary text-lg">
            Create Your First Space
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {spaces.map((space) => (
            <Link
              key={space.id}
              href={`/dashboard/spaces/${space.id}`}
              className="glass-card p-6 group hover:border-brand-500/20 transition-all duration-200 block"
            >
              <div className="flex items-start gap-4 mb-4">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${space.color}15`, border: `1px solid ${space.color}30` }}
                >
                  {space.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white group-hover:text-brand-300 transition-colors truncate text-lg">
                    {space.name}
                  </h3>
                  <p className="text-sm text-gray-400 line-clamp-2 mt-1">
                    {space.description || 'No description'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <span className="text-sm text-gray-400">
                  {space._count.projects} {space._count.projects === 1 ? 'project' : 'projects'}
                </span>
                <span className="text-xs text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  Open →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
