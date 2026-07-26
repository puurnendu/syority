'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';

export default function ReportsPage() {
  const params = useParams();
  const projectId = params?.id as string;
  const [report, setReport] = useState('');
  const [generating, setGenerating] = useState(false);
  const [stats, setStats] = useState<{
    activitiesIncluded: number;
    openConstraints: number;
    punchA: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!projectId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/reports/daily`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Generation failed');
      setReport(data.report ?? '');
      setStats(data.stats ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const copy = () => report && navigator.clipboard.writeText(report);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Reports</h1>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">AI Daily Progress Report</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Generated from today&apos;s active activities, constraints, and punch items
            </p>
          </div>
          <button
            onClick={generate}
            disabled={generating}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {generating ? (
              <>
                <span className="animate-spin inline-block">⟳</span> Generating…
              </>
            ) : (
              '✨ Generate Report'
            )}
          </button>
        </div>

        <div className="p-5">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              ⚠ {error}
            </div>
          )}

          {!report && !generating && !error && (
            <div className="text-center py-14">
              <p className="text-4xl mb-3">📄</p>
              <p className="text-sm font-medium text-gray-600">No report generated yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Click &quot;Generate Report&quot; to create today&apos;s AI-assisted progress summary
              </p>
            </div>
          )}

          {generating && (
            <div className="text-center py-14">
              <p className="text-3xl animate-pulse mb-3">✨</p>
              <p className="text-sm text-gray-500">AI is analysing today&apos;s progress data…</p>
            </div>
          )}

          {report && !generating && (
            <>
              {stats && (
                <div className="flex gap-4 mb-4">
                  {[
                    { label: 'Activities included', value: stats.activitiesIncluded },
                    { label: 'Open constraints', value: stats.openConstraints },
                    { label: 'A-punch items', value: stats.punchA },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="flex-1 text-center bg-gray-50 border border-gray-100 rounded-lg p-3"
                    >
                      <p className="text-xl font-bold text-gray-900">{s.value}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-mono">
                {report}
              </div>

              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={copy}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:border-gray-400 text-gray-600 flex items-center gap-1.5"
                >
                  📋 Copy to clipboard
                </button>
                <button
                  onClick={generate}
                  className="px-3 py-1.5 text-sm text-indigo-500 hover:text-indigo-700"
                >
                  ↺ Regenerate
                </button>
                <span className="ml-auto text-xs text-gray-400">
                  AI-generated — review before distributing
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
