'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

type BatchDetail = {
  id: string;
  name: string;
  source_type: string;
  source_filename: string | null;
  source_department: string | null;
  status: string;
  ai_extraction_used: boolean;
  created_at: string;
  live_stats: {
    total: number;
    matched: number;
    unmatched: number;
    pending_review: number;
    duplicate: number;
    resolved: number;
    rejected: number;
    draft: number;
  };
  by_department: Array<{ department: string | null; count: number }>;
  by_priority: Array<{ priority: string; count: number }>;
};

type Issue = {
  id: string;
  issue_number: string | null;
  equipment_tag_raw: string | null;
  department: string | null;
  discipline: string | null;
  problem: string;
  recommendation: string | null;
  priority: string;
  status: string;
  match_confidence: number | null;
  match_method: string | null;
  ai_failure_mode: string | null;
  originator: string | null;
  asset: { id: string; tag_number: string; name: string } | null;
  _count: { attachments: number; duplicates_as_a: number; duplicates_as_b: number };
};

type DuplicatePair = {
  id: string;
  similarity_score: number;
  similarity_method: string;
  ai_reasoning: string | null;
  resolution: string | null;
  issue_a: { id: string; issue_number: string | null; problem: string; equipment_tag_raw: string | null; department: string | null };
  issue_b: { id: string; issue_number: string | null; problem: string; equipment_tag_raw: string | null; department: string | null };
};

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  pending_review: 'bg-amber-100 text-amber-700',
  matched: 'bg-emerald-100 text-emerald-700',
  unmatched: 'bg-red-100 text-red-700',
  duplicate: 'bg-purple-100 text-purple-700',
  resolved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-gray-200 text-gray-500',
};

const PRIORITY_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-green-100 text-green-800',
  unclassified: 'bg-gray-100 text-gray-600',
};

export default function BatchDetailPage() {
  const router = useRouter();
  const params = useParams();
  const batchId = params.batchId as string;

  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
  const [total, setTotal] = useState(0);
  const [tab, setTab] = useState<'all' | 'review' | 'duplicates' | 'stats'>('all');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Load batch details
  useEffect(() => {
    fetch(`/api/engineering-issues/batches/${batchId}`)
      .then((r) => r.json())
      .then(setBatch)
      .catch(() => {});
  }, [batchId]);

  // Load issues based on tab
  const loadIssues = useCallback(async () => {
    setLoading(true);
    let status = statusFilter;
    if (tab === 'review') status = 'pending_review';

    const qs = new URLSearchParams({
      batch_id: batchId,
      page: String(page),
      page_size: '50',
    });
    if (status) qs.set('status', status);

    const res = await fetch(`/api/engineering-issues/issues?${qs}`);
    const data = await res.json();
    setIssues(data.data || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [batchId, tab, statusFilter, page]);

  useEffect(() => {
    if (tab !== 'duplicates' && tab !== 'stats') loadIssues();
  }, [loadIssues, tab]);

  // Load duplicates
  useEffect(() => {
    if (tab === 'duplicates') {
      fetch(`/api/engineering-issues/duplicates?resolved=false`)
        .then((r) => r.json())
        .then((d) => setDuplicates(d.data || []))
        .catch(() => {});
    }
  }, [tab]);

  // Actions
  const matchAll = async () => {
    setActionLoading('match');
    await fetch('/api/engineering-issues/import/match-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch_id: batchId }),
    });
    setActionLoading(null);
    loadIssues();
    // Refresh batch stats
    const b = await fetch(`/api/engineering-issues/batches/${batchId}`).then((r) => r.json());
    setBatch(b);
  };

  const classifyAll = async () => {
    setActionLoading('classify');
    await fetch('/api/engineering-issues/import/classify-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch_id: batchId }),
    });
    setActionLoading(null);
    loadIssues();
  };

  const detectDuplicates = async () => {
    setActionLoading('duplicates');
    await fetch('/api/engineering-issues/duplicates/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch_id: batchId }),
    });
    setActionLoading(null);
    setTab('duplicates');
  };

  const resolveDuplicate = async (dupId: string, resolution: string) => {
    setActionLoading(dupId);
    await fetch(`/api/engineering-issues/duplicates/${dupId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution }),
    });
    setActionLoading(null);
    setDuplicates((prev) => prev.filter((d) => d.id !== dupId));
  };

  const acceptMatch = async (issueId: string, assetId: string) => {
    setActionLoading(issueId);
    await fetch(`/api/engineering-issues/issues/${issueId}/accept-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_id: assetId }),
    });
    setActionLoading(null);
    loadIssues();
  };

  const rejectMatch = async (issueId: string) => {
    setActionLoading(issueId);
    await fetch(`/api/engineering-issues/issues/${issueId}/reject-match`, {
      method: 'POST',
    });
    setActionLoading(null);
    loadIssues();
  };

  if (!batch) {
    return (
      <div className="flex justify-center py-20 text-gray-400">
        <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading batch...
      </div>
    );
  }

  const ls = batch.live_stats;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/engineering-issues" className="hover:text-blue-600">Scope Intelligence</Link>
        <span>→</span>
        <span className="text-gray-900 font-medium">{batch.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{batch.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {batch.source_type.toUpperCase()} · {batch.source_department || 'All departments'} · {new Date(batch.created_at).toLocaleDateString()}
            {batch.ai_extraction_used && <span className="ml-2 text-purple-600">🤖 AI Extracted</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={matchAll}
            disabled={!!actionLoading}
            className="px-3 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {actionLoading === 'match' ? '⏳ Matching...' : '🔗 Match All'}
          </button>
          <button
            onClick={classifyAll}
            disabled={!!actionLoading}
            className="px-3 py-2 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {actionLoading === 'classify' ? '⏳ Classifying...' : '🤖 Classify All'}
          </button>
          <button
            onClick={detectDuplicates}
            disabled={!!actionLoading}
            className="px-3 py-2 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {actionLoading === 'duplicates' ? '⏳ Detecting...' : '🔍 Find Duplicates'}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-6">
        {[
          { label: 'Total', value: ls.total, color: 'text-gray-900' },
          { label: 'Matched', value: ls.matched, color: 'text-emerald-600' },
          { label: 'Unmatched', value: ls.unmatched, color: 'text-red-500' },
          { label: 'Pending', value: ls.pending_review, color: 'text-amber-600' },
          { label: 'Duplicates', value: ls.duplicate, color: 'text-purple-600' },
          { label: 'Resolved', value: ls.resolved, color: 'text-blue-600' },
          { label: 'Rejected', value: ls.rejected, color: 'text-gray-400' },
          { label: 'Draft', value: ls.draft, color: 'text-gray-500' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-gray-200 p-3 text-center">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4">
        <div className="flex gap-6">
          {[
            { key: 'all' as const, label: 'All Issues', count: ls.total },
            { key: 'review' as const, label: 'Review Queue', count: ls.pending_review },
            { key: 'duplicates' as const, label: 'Duplicates', count: ls.duplicate },
            { key: 'stats' as const, label: 'Stats', count: null },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPage(1); }}
              className={`pb-3 text-sm font-medium border-b-2 ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              {t.count !== null && <span className="ml-1 text-xs bg-gray-100 px-1.5 py-0.5 rounded-full">{t.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: All Issues / Review Queue */}
      {(tab === 'all' || tab === 'review') && (
        <>
          {tab === 'all' && (
            <div className="flex items-center gap-2 mb-4">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="">All statuses</option>
                {Object.keys(STATUS_STYLES).map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
              <span className="text-sm text-gray-400">{total} issues</span>
            </div>
          )}

          {loading ? (
            <div className="text-center py-10 text-gray-400">Loading issues...</div>
          ) : issues.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              {tab === 'review' ? 'No issues pending review 🎉' : 'No issues found'}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 uppercase">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Issue #</th>
                    <th className="px-3 py-2.5 text-left">Tag</th>
                    <th className="px-3 py-2.5 text-left">Matched Asset</th>
                    <th className="px-3 py-2.5 text-left">Dept</th>
                    <th className="px-3 py-2.5 text-left">Problem</th>
                    <th className="px-3 py-2.5 text-left">Priority</th>
                    <th className="px-3 py-2.5 text-left">Discipline</th>
                    <th className="px-3 py-2.5 text-left">Status</th>
                    <th className="px-3 py-2.5 text-left">Conf.</th>
                    {tab === 'review' && <th className="px-3 py-2.5 text-left">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {issues.map((issue) => (
                    <tr key={issue.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 font-mono text-gray-700">{issue.issue_number || '—'}</td>
                      <td className="px-3 py-2.5 font-mono font-semibold text-gray-900">{issue.equipment_tag_raw || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-700">
                        {issue.asset ? (
                          <span className="text-emerald-600 font-medium">{issue.asset.tag_number}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">{issue.department || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-700 max-w-xs truncate" title={issue.problem}>{issue.problem}</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${PRIORITY_STYLES[issue.priority] || ''}`}>
                          {issue.priority}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">{issue.discipline || '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_STYLES[issue.status] || ''}`}>
                          {issue.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-500">
                        {issue.match_confidence ? `${Math.round(issue.match_confidence * 100)}%` : '—'}
                      </td>
                      {tab === 'review' && (
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1">
                            {issue.asset && (
                              <button
                                onClick={() => acceptMatch(issue.id, issue.asset!.id)}
                                disabled={actionLoading === issue.id}
                                className="px-2 py-1 text-[10px] font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                              >
                                ✓ Accept
                              </button>
                            )}
                            <button
                              onClick={() => rejectMatch(issue.id)}
                              disabled={actionLoading === issue.id}
                              className="px-2 py-1 text-[10px] font-semibold bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                            >
                              ✕ Reject
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {total > 50 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                ← Prev
              </button>
              <span className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 50)}</span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= Math.ceil(total / 50)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* Tab: Duplicates */}
      {tab === 'duplicates' && (
        <div>
          {duplicates.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              No unresolved duplicates. Click "Find Duplicates" to scan.
            </div>
          ) : (
            <div className="space-y-3">
              {duplicates.map((dup) => (
                <div key={dup.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
                      {Math.round(dup.similarity_score * 100)}% similar · {dup.similarity_method}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => resolveDuplicate(dup.id, 'merge_into_a')}
                        disabled={actionLoading === dup.id}
                        className="px-2 py-1 text-[10px] font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        Merge → A
                      </button>
                      <button
                        onClick={() => resolveDuplicate(dup.id, 'merge_into_b')}
                        disabled={actionLoading === dup.id}
                        className="px-2 py-1 text-[10px] font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        Merge → B
                      </button>
                      <button
                        onClick={() => resolveDuplicate(dup.id, 'keep_separate')}
                        disabled={actionLoading === dup.id}
                        className="px-2 py-1 text-[10px] font-semibold bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                      >
                        Keep Separate
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Issue A</p>
                      <p className="text-xs font-mono text-gray-600">{dup.issue_a.equipment_tag_raw || '—'}</p>
                      <p className="text-xs text-gray-800 mt-1">{dup.issue_a.problem}</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3">
                      <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Issue B</p>
                      <p className="text-xs font-mono text-gray-600">{dup.issue_b.equipment_tag_raw || '—'}</p>
                      <p className="text-xs text-gray-800 mt-1">{dup.issue_b.problem}</p>
                    </div>
                  </div>

                  {dup.ai_reasoning && (
                    <p className="text-[11px] text-gray-500 mt-2 italic">🤖 {dup.ai_reasoning}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Stats */}
      {tab === 'stats' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">By Department</h3>
            {batch.by_department.length === 0 ? (
              <p className="text-sm text-gray-400">No data</p>
            ) : (
              <div className="space-y-2">
                {batch.by_department.map((d) => {
                  const pct = ls.total > 0 ? (d.count / ls.total) * 100 : 0;
                  return (
                    <div key={d.department}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{d.department || 'Unknown'}</span>
                        <span className="font-semibold text-gray-900">{d.count}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">By Priority</h3>
            {batch.by_priority.length === 0 ? (
              <p className="text-sm text-gray-400">No data</p>
            ) : (
              <div className="space-y-2">
                {batch.by_priority.map((p) => {
                  const pct = ls.total > 0 ? (p.count / ls.total) * 100 : 0;
                  const barColor: Record<string, string> = {
                    critical: 'bg-red-500',
                    high: 'bg-orange-500',
                    medium: 'bg-amber-400',
                    low: 'bg-green-500',
                    unclassified: 'bg-gray-400',
                  };
                  return (
                    <div key={p.priority}>
                      <div className="flex items-center justify-between text-sm">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITY_STYLES[p.priority] || ''}`}>
                          {p.priority}
                        </span>
                        <span className="font-semibold text-gray-900">{p.count}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                        <div className={`${barColor[p.priority] || 'bg-gray-400'} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Batch Info</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div><p className="text-gray-400 text-xs">Source</p><p className="font-medium">{batch.source_type}</p></div>
              <div><p className="text-gray-400 text-xs">File</p><p className="font-medium">{batch.source_filename || '—'}</p></div>
              <div><p className="text-gray-400 text-xs">Department</p><p className="font-medium">{batch.source_department || '—'}</p></div>
              <div><p className="text-gray-400 text-xs">Status</p><p className="font-medium">{batch.status}</p></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
