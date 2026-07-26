'use client';

import { useState, useEffect, useCallback } from 'react';

const JOB_LABELS: Record<string, string> = {
  workpack_generation: 'Workpack Gen',
  document_parameter_extraction: 'Doc Extraction',
  lessons_suggestion: 'Lessons AI',
  whatsapp_extraction: 'WhatsApp Extract',
  whatsapp_report: 'WhatsApp Report',
  document_vision: 'Vision / P&ID',
};

type LogRow = {
  id: string;
  job_type: string;
  provider: string | null;
  model: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  latency_ms: number | null;
  status: string;
  error_message: string | null;
  created_at: string;
};

type LogDetail = LogRow & {
  user_id: string | null;
  prompt: string | null;
  response: string | null;
};

type Meta = { total: number; page: number; limit: number; pages: number };

export default function AiLogsTab() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 50, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [detail, setDetail] = useState<LogDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: '50' });
    if (filterStatus) params.set('status', filterStatus);
    if (filterType) params.set('job_type', filterType);
    try {
      const res = await fetch(`/api/ai-logs?${params}`);
      const json = await res.json();
      setLogs(json.data ?? []);
      setMeta(json.meta ?? { total: 0, page: 1, limit: 50, pages: 1 });
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterType]);

  useEffect(() => { load(1); setPage(1); }, [filterStatus, filterType, load]);

  async function openDetail(id: string) {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/ai-logs/${id}`);
      const json = await res.json();
      setDetail(json.data);
    } finally {
      setDetailLoading(false);
    }
  }

  function fmtDate(d: string) {
    return new Date(d).toLocaleString();
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg bg-gray-800 border border-gray-700 text-gray-200 outline-none"
        >
          <option value="">All Statuses</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg bg-gray-800 border border-gray-700 text-gray-200 outline-none"
        >
          <option value="">All Job Types</option>
          {Object.entries(JOB_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <span className="ml-auto text-xs text-gray-500 self-center">
          {meta.total} total entries
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Time</th>
              <th className="px-4 py-3 text-left">Job Type</th>
              <th className="px-4 py-3 text-left">Model</th>
              <th className="px-4 py-3 text-right">Tokens</th>
              <th className="px-4 py-3 text-right">Latency</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-500 animate-pulse">Loading…</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-500">No log entries found.</td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-800/30 transition">
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{fmtDate(log.created_at)}</td>
                  <td className="px-4 py-3 text-gray-200">{JOB_LABELS[log.job_type] ?? log.job_type}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{log.model ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-400 text-xs tabular-nums">
                    {log.tokens_input != null || log.tokens_output != null
                      ? `${log.tokens_input ?? 0} / ${log.tokens_output ?? 0}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 text-xs tabular-nums">
                    {log.latency_ms != null ? `${(log.latency_ms / 1000).toFixed(1)}s` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      log.status === 'success'
                        ? 'bg-green-500/15 text-green-400'
                        : 'bg-red-500/15 text-red-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${log.status === 'success' ? 'bg-green-400' : 'bg-red-400'}`} />
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openDetail(log.id)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition"
                    >
                      View →
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta.pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => { setPage(p => { const np = p - 1; load(np); return np; }); }}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-300 border border-gray-700 disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-xs text-gray-400 self-center">Page {page} / {meta.pages}</span>
          <button
            onClick={() => { setPage(p => { const np = p + 1; load(np); return np; }); }}
            disabled={page >= meta.pages}
            className="px-3 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-300 border border-gray-700 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {(detail || detailLoading) && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading ? (
              <div className="p-12 text-center text-gray-400 animate-pulse">Loading detail…</div>
            ) : detail ? (
              <>
                <div className="p-5 border-b border-gray-700 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-white">
                      {JOB_LABELS[detail.job_type] ?? detail.job_type}
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">{fmtDate(detail.created_at)} · {detail.provider} / {detail.model}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                      detail.status === 'success'
                        ? 'bg-green-500/15 text-green-400'
                        : 'bg-red-500/15 text-red-400'
                    }`}>
                      {detail.status}
                    </span>
                    <button onClick={() => setDetail(null)} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-gray-800">
                  {detail.error_message && (
                    <div className="p-4 bg-red-900/20 border-b border-red-800">
                      <p className="text-xs font-semibold text-red-400 mb-1">Error</p>
                      <pre className="text-xs text-red-300 whitespace-pre-wrap">{detail.error_message}</pre>
                    </div>
                  )}
                  <div className="p-5">
                    <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Prompt Sent</p>
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono bg-gray-800/50 rounded-lg p-4 max-h-64 overflow-y-auto">
                      {detail.prompt ?? '(not captured)'}
                    </pre>
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">AI Response</p>
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono bg-gray-800/50 rounded-lg p-4 max-h-64 overflow-y-auto">
                      {detail.response ?? '(not captured)'}
                    </pre>
                  </div>
                  <div className="p-5 flex gap-6 text-xs text-gray-400">
                    <span>Input tokens: <strong className="text-gray-200">{detail.tokens_input ?? '—'}</strong></span>
                    <span>Output tokens: <strong className="text-gray-200">{detail.tokens_output ?? '—'}</strong></span>
                    <span>Latency: <strong className="text-gray-200">{detail.latency_ms != null ? `${(detail.latency_ms / 1000).toFixed(2)}s` : '—'}</strong></span>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
