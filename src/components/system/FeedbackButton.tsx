'use client';

/**
 * M7.6G — Beta Feedback Button
 *
 * Floating button available on every page.
 * Auto-captures: route, module, browser, OS, resolution.
 */

import { useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';

const TYPES = [
  { key: 'bug', label: '🐛 Report Bug', color: '#ef4444' },
  { key: 'improvement', label: '💡 Suggest Improvement', color: '#3b82f6' },
  { key: 'feature_request', label: '✨ Feature Request', color: '#8b5cf6' },
  { key: 'question', label: '❓ Question', color: '#f59e0b' },
  { key: 'general', label: '💬 General Feedback', color: '#6b7280' },
];

const SEVERITIES = [
  { key: 'low', label: 'Low', color: '#6b7280' },
  { key: 'medium', label: 'Medium', color: '#3b82f6' },
  { key: 'high', label: 'High', color: '#f59e0b' },
  { key: 'critical', label: 'Critical', color: '#ef4444' },
];

export function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState('general');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  const detectModule = useCallback(() => {
    if (!pathname) return 'unknown';
    if (pathname.includes('/platform')) return 'platform_admin';
    if (pathname.includes('/planner')) return 'planner_workspace';
    if (pathname.includes('/ois')) return 'ois';
    if (pathname.includes('/safety')) return 'safety';
    if (pathname.includes('/reports')) return 'reports';
    if (pathname.includes('/alerts')) return 'bre';
    if (pathname.includes('/digital-plant')) return 'digital_plant';
    if (pathname.includes('/settings')) return 'settings';
    return 'general';
  }, [pathname]);

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !description.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim(),
          severity,
          route: pathname,
          currentModule: detectModule(),
          browser: typeof navigator !== 'undefined' ? navigator.userAgent.split(' ').slice(-2).join(' ') : undefined,
          os: typeof navigator !== 'undefined' ? navigator.platform : undefined,
          resolution: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : undefined,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || 'Failed to submit');
      }

      setSubmitted(true);
      setTitle('');
      setDescription('');
      setSeverity('medium');
      setTimeout(() => {
        setSubmitted(false);
        setIsOpen(false);
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [type, title, description, severity, pathname, detectModule]);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 hover:scale-105 transition-all flex items-center justify-center text-xl"
        title="Send Feedback"
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {/* Feedback Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-96 max-h-[70vh] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
            <h3 className="text-sm font-semibold">Beta Feedback</h3>
            <p className="text-xs text-indigo-100 mt-0.5">Help us improve Aurianoa OS</p>
          </div>

          {submitted ? (
            <div className="p-8 text-center">
              <span className="text-4xl">✅</span>
              <p className="text-sm font-medium text-gray-700 mt-3">Thank you for your feedback!</p>
            </div>
          ) : (
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Type */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {TYPES.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setType(t.key)}
                      className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                        type === t.key
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700 font-medium'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief summary..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                  maxLength={200}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What happened? What did you expect?"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                  maxLength={5000}
                />
              </div>

              {/* Severity (for bugs) */}
              {type === 'bug' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Severity</label>
                  <div className="flex gap-2">
                    {SEVERITIES.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => setSeverity(s.key)}
                        className={`flex-1 px-2 py-1.5 text-xs rounded-lg border transition ${
                          severity === s.key
                            ? 'font-medium'
                            : 'border-gray-200 text-gray-500'
                        }`}
                        style={severity === s.key ? {
                          borderColor: s.color,
                          backgroundColor: `${s.color}10`,
                          color: s.color,
                        } : undefined}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Auto-captured context */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Auto-captured context:</p>
                <p className="text-xs text-gray-500">
                  Route: <span className="font-mono">{pathname}</span>
                </p>
                <p className="text-xs text-gray-500">
                  Module: {detectModule()}
                </p>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">{error}</div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={loading || !title.trim() || !description.trim()}
                className="w-full px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {loading ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default FeedbackButton;
