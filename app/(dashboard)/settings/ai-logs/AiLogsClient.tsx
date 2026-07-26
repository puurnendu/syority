'use client';

import { useState, useEffect } from 'react';

type AiLog = {
  id: string;
  user_id: string | null;
  job_type: string;
  provider: string;
  model: string;
  tokens_input: number | null;
  tokens_output: number | null;
  latency_ms: number | null;
  status: string;
  error_message: string | null;
  created_at: string;
};

export function AiLogsClient() {
  const [logs, setLogs] = useState<AiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadLogs(page);
  }, [page]);

  const loadLogs = async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai-logs?page=${p}&limit=20`);
      const json = await res.json();
      if (json.data) {
        setLogs(json.data);
        setTotalPages(json.meta.pages || 1);
      } else {
        setError(json.error || 'Failed to load logs');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalInput = logs.reduce((sum, log) => sum + (log.tokens_input || 0), 0);
  const totalOutput = logs.reduce((sum, log) => sum + (log.tokens_output || 0), 0);
  const avgLatency = logs.length > 0 
    ? Math.round(logs.reduce((sum, log) => sum + (log.latency_ms || 0), 0) / logs.length) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase">Page Total Input</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{totalInput.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase">Page Total Output</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{totalOutput.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase">Avg Latency</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{avgLatency} ms</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase">Error Rate</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {logs.length > 0 ? Math.round((logs.filter(l => l.status === 'error').length / logs.length) * 100) : 0}%
          </div>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">{error}</div>}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">In / Out</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Latency</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">Loading logs...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">No AI logs found.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">
                      {log.job_type.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex flex-col">
                        <span>{log.model || 'Unknown'}</span>
                        <span className="text-xs text-gray-400">{log.provider || 'default'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right">
                      {log.tokens_input?.toLocaleString() || 0} / {log.tokens_output?.toLocaleString() || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right">
                      {log.latency_ms ? `${log.latency_ms} ms` : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        log.status === 'success' ? 'bg-green-100 text-green-800' : 
                        log.status === 'error' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="bg-white px-4 py-3 border-t border-gray-200 flex items-center justify-between sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
