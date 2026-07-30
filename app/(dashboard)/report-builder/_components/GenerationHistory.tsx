'use client';

import useSWR from 'swr';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  completed: { bg: '#D1FAE5', text: '#059669', dot: '#059669' },
  failed: { bg: '#FEE2E2', text: '#DC2626', dot: '#DC2626' },
  generating: { bg: '#DBEAFE', text: '#2563EB', dot: '#2563EB' },
  pending: { bg: '#F3F4F6', text: '#6B7280', dot: '#6B7280' },
  cancelled: { bg: '#FEF3C7', text: '#92400E', dot: '#92400E' },
};

export function GenerationHistory() {
  const { data, isLoading } = useSWR('/api/report-builder/generations?limit=100', fetcher);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#E8701A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const generations = data?.generations ?? [];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/report-builder" className="text-gray-400 hover:text-gray-600">←</Link>
          <div>
            <h1 className="text-xl font-bold text-[#0D2137]">Generation History</h1>
            <p className="text-sm text-gray-500 mt-1">{generations.length} reports generated</p>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="flex-1 overflow-y-auto p-6">
        {generations.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-lg font-medium">No reports generated yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Report</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Format</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Generated</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {generations.map((g: any, i: number) => {
                  const sc = STATUS_COLORS[g.status] ?? STATUS_COLORS.pending;
                  return (
                    <tr key={g.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-[#0D2137]">
                          {g.definition?.category?.icon} {g.definition?.name}
                        </div>
                        {g.resolved_subject && (
                          <div className="text-xs text-gray-400 mt-0.5">{g.resolved_subject}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {g.output_format?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full"
                          style={{ backgroundColor: sc.bg, color: sc.text }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.dot }} />
                          {g.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(g.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {g.duration_ms ? `${(g.duration_ms / 1000).toFixed(1)}s` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {g.status === 'completed' && g.html_content && (
                          <a
                            href={`/api/report-builder/generations/${g.id}/download`}
                            className="text-xs font-medium text-[#E8701A] hover:underline"
                          >
                            ⬇ Download
                          </a>
                        )}
                        {g.status === 'failed' && g.error_message && (
                          <span className="text-xs text-red-500" title={g.error_message}>⚠️ Error</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
