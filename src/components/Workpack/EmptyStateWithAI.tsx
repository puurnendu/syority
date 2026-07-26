'use client';

import { useState } from 'react';

interface EmptyStateWithAIProps {
  tabName: string;
  workpackId: string;
  icon: string;
  emptyText: string;
  onGenerated: () => void;
}

export function EmptyStateWithAI({
  tabName,
  workpackId,
  icon,
  emptyText,
  onGenerated,
}: EmptyStateWithAIProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const endpoint =
    tabName === 'joints'
      ? `/api/workpacks/${workpackId}/joints/generate-from-drawing`
      : `/api/workpacks/${workpackId}/${tabName}/generate-with-ai`;

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoSave: true }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error ?? `Server error ${res.status}`);
      }

      const count = data.count ?? data.created ?? 0;
      setDone(true);
      onGenerated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  }

  if (done) return null;

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-5">
      <div className="text-6xl opacity-20 select-none">{icon}</div>
      <div className="text-center">
        <p className="text-gray-600 font-medium">{emptyText}</p>
        <p className="text-gray-400 text-sm mt-1">
          Generate automatically with AI or add manually
        </p>
      </div>
      {error && (
        <div className="max-w-sm text-center bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          <strong>Error:</strong> {error}
        </div>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Generating...
            </>
          ) : (
            <>🤖 Generate with AI</>
          )}
        </button>
        <button
          type="button"
          disabled={loading}
          className="px-6 py-2.5 border border-gray-200 hover:bg-gray-50 rounded-lg text-sm text-gray-600 disabled:opacity-40"
        >
          + Add Manually
        </button>
      </div>
      {loading && (
        <p className="text-xs text-violet-500 animate-pulse">
          AI is analysing workpack data — this takes 5-15 seconds...
        </p>
      )}
    </div>
  );
}
