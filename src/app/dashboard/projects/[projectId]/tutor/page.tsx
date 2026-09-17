'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

interface Citation {
  materialId: string;
  materialName: string;
  pageNumber: number;
  chunkId: string;
  excerpt: string;
}

export default function TutorPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [showCitations, setShowCitations] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch project name
  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setProjectName(d.data.name); })
      .catch(() => {});
  }, [projectId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // Add user message
    const userMsg: Message = { id: `user-${Date.now()}`, role: 'user', content: userMessage };
    setMessages((prev) => [...prev, userMsg]);

    // Add placeholder assistant message
    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '', citations: [] }]);

    try {
      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          conversationId: conversationId || undefined,
          message: userMessage,
        }),
      });

      if (!response.ok) {
        let errText = `Failed with status ${response.status}`;
        try {
          const errData = await response.json();
          if (errData?.error) errText = errData.error;
        } catch {}
        throw new Error(errText);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6);
          
          try {
            const data = JSON.parse(jsonStr);

            if (data.type === 'meta') {
              setConversationId(data.conversationId);
              if (data.citations?.length > 0) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, citations: data.citations } : m
                  )
                );
              }
            } else if (data.type === 'text') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + data.content } : m
                )
              );
            } else if (data.type === 'error') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: `⚠️ ${data.message}` } : m
                )
              );
            }
          } catch {}
        }
      }
    } catch (error: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `⚠️ ${error?.message || 'Failed to get a response. Please try again.'}` }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] md:h-[calc(100vh-5rem)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-4 pb-3 sm:pb-4 border-b border-white/5 flex-shrink-0">
        <button onClick={() => router.push(`/dashboard/projects/${projectId}`)} className="btn-ghost text-xs sm:text-sm px-2.5 sm:px-4">
          ← Back
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base sm:text-xl font-bold text-white truncate">💬 AI Tutor</h1>
          <p className="text-xs sm:text-sm text-gray-400 truncate">{projectName}</p>
        </div>
        <button
          onClick={() => { setMessages([]); setConversationId(null); }}
          className="btn-ghost text-xs sm:text-sm px-2.5 sm:px-4"
        >
          <span className="hidden sm:inline">New Conversation</span>
          <span className="sm:hidden">+ New</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-6 space-y-6">
        {messages.length === 0 && (
          <div className="text-center py-20">
            <span className="text-5xl block mb-4">💬</span>
            <h2 className="text-xl font-bold text-white mb-2">Ask Your AI Tutor</h2>
            <p className="text-gray-400 max-w-md mx-auto mb-6">
              Ask questions about your study materials. The tutor will ground answers in your uploaded content and cite sources.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                'Explain the key concepts',
                'What are the main topics?',
                'Give me a summary',
                'Help me understand this better',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="px-4 py-2 bg-surface-overlay/50 border border-white/10 rounded-xl text-sm text-gray-300 hover:border-brand-500/30 hover:text-brand-300 transition-all"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-sm">🧠</span>
              </div>
            )}
            <div className={`max-w-[90%] sm:max-w-[80%] ${msg.role === 'user' ? 'order-1' : ''}`}>
              <div
                className={`px-4 py-3 rounded-2xl whitespace-pre-wrap text-sm leading-relaxed
                  ${msg.role === 'user'
                    ? 'bg-brand-600 text-white rounded-br-md'
                    : 'bg-surface-raised border border-white/5 text-gray-200 rounded-bl-md'
                  }`}
              >
                {msg.content || (
                  <div className="flex items-center gap-2 text-gray-400">
                    <div className="w-2 h-2 bg-brand-400 rounded-full animate-pulse" />
                    <div className="w-2 h-2 bg-brand-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 bg-brand-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                  </div>
                )}
              </div>

              {/* Citations */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowCitations(showCitations === msg.id ? null : msg.id)}
                    className="text-xs text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1"
                  >
                    📎 {msg.citations.length} source{msg.citations.length > 1 ? 's' : ''}
                    <span className="text-[10px]">{showCitations === msg.id ? '▲' : '▼'}</span>
                  </button>
                  {showCitations === msg.id && (
                    <div className="mt-2 space-y-1 animate-fade-in">
                      {msg.citations.map((cite, i) => (
                        <div
                          key={i}
                          className="px-3 py-2 bg-surface-overlay/50 rounded-lg border border-white/5 text-xs"
                        >
                          <p className="text-brand-300 font-medium">
                            Source: {cite.materialName} — Page {cite.pageNumber}
                          </p>
                          <p className="text-gray-500 mt-1 line-clamp-2">{cite.excerpt}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-surface-overlay flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-sm">👤</span>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="pt-4 border-t border-white/5">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your study materials..."
            className="input-field resize-none h-12 flex-1"
            rows={1}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="btn-primary px-6 flex-shrink-0"
          >
            {loading ? '...' : 'Send'}
          </button>
        </form>
        <p className="text-xs text-gray-600 mt-2 text-center">
          Answers are grounded in your uploaded materials. Sources are cited when available.
        </p>
      </div>
    </div>
  );
}
