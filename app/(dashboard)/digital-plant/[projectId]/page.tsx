'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type ProjectDetail = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  Site: { id: string; name: string; code: string | null };
  Plant: { id: string; name: string; code: string | null };
  Unit: { id: string; name: string; code: string | null };
  total_documents: number;
  live_stats: { pending: number; approved: number; rejected: number; total: number };
  created_at: string;
};

type Document = {
  id: string;
  document_type: string;
  drawing_number: string | null;
  title: string;
  revision: string | null;
  discipline: string | null;
  status: string;
  original_filename: string;
  file_size_bytes: number;
  candidate_count: number;
  created_at: string;
};

type Candidate = {
  id: string;
  candidate_type: string;
  tag_number: string;
  description: string | null;
  confidence_score: number;
  status: string;
  source_document: { id: string; drawing_number: string | null; title: string; document_type: string };
  reviewed_by: string | null;
  reviewed_at: string | null;
};

const TABS = ['documents', 'review', 'assets', 'search', 'import'] as const;
type Tab = typeof TABS[number];

const DOC_TYPES = [
  'P&ID', 'PFD', 'GA Drawing', 'Equipment Layout', 'Isometric',
  'OEM Manual', 'Datasheet', 'Line List', 'Valve List',
  'Instrument Index', 'Equipment List', 'Other',
];

const STATUS_BADGE: Record<string, string> = {
  pending_review: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700',
  merged: 'bg-blue-100 text-blue-800',
  edited: 'bg-purple-100 text-purple-800',
};

const CONF_COLOR = (c: number) =>
  c >= 0.8 ? 'text-emerald-600' : c >= 0.6 ? 'text-amber-600' : 'text-red-500';

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [tab, setTab] = useState<Tab>('documents');
  const [loading, setLoading] = useState(true);

  // Documents
  const [documents, setDocuments] = useState<Document[]>([]);
  const [docTotal, setDocTotal] = useState(0);
  const [uploading, setUploading] = useState(false);

  // Candidates / Review
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candTotal, setCandTotal] = useState(0);
  const [candFilter, setCandFilter] = useState('pending_review');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState('');

  // Fetch project
  useEffect(() => {
    fetch(`/api/digital-plant/projects/${projectId}`)
      .then((r) => r.json())
      .then((d) => { setProject(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId]);

  // Fetch documents
  const fetchDocs = useCallback(async () => {
    const res = await fetch(`/api/digital-plant/projects/${projectId}/documents`);
    const data = await res.json();
    setDocuments(data.data || []);
    setDocTotal(data.total || 0);
  }, [projectId]);

  // Fetch candidates
  const fetchCandidates = useCallback(async () => {
    const params = new URLSearchParams({ status: candFilter });
    const res = await fetch(`/api/digital-plant/projects/${projectId}/candidates?${params}`);
    const data = await res.json();
    setCandidates(data.data || []);
    setCandTotal(data.total || 0);
  }, [projectId, candFilter]);

  useEffect(() => { if (tab === 'documents') fetchDocs(); }, [tab, fetchDocs]);
  useEffect(() => { if (tab === 'review') fetchCandidates(); }, [tab, fetchCandidates]);

  // Upload document
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('title', file.name);
    form.append('document_type', 'Other');
    await fetch(`/api/digital-plant/projects/${projectId}/documents`, { method: 'POST', body: form });
    setUploading(false);
    fetchDocs();
  };

  // Extract from document
  const handleExtract = async (docId: string) => {
    await fetch(`/api/digital-plant/documents/${docId}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId }),
    });
    fetchDocs();
    fetchCandidates();
  };

  // Review actions
  const handleApprove = async (candidateId: string) => {
    setActionLoading(candidateId);
    await fetch(`/api/digital-plant/candidates/${candidateId}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    setActionLoading('');
    fetchCandidates();
  };

  const handleReject = async (candidateId: string) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    setActionLoading(candidateId);
    await fetch(`/api/digital-plant/candidates/${candidateId}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    setActionLoading('');
    fetchCandidates();
  };

  const handleBulkApprove = async () => {
    if (selected.size === 0) return;
    setActionLoading('bulk');
    await fetch('/api/digital-plant/candidates/bulk-approve', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate_ids: Array.from(selected) }),
    });
    setSelected(new Set());
    setActionLoading('');
    fetchCandidates();
  };

  const handleBulkReject = async () => {
    if (selected.size === 0) return;
    const reason = prompt('Rejection reason for all selected:');
    if (!reason) return;
    setActionLoading('bulk');
    await fetch('/api/digital-plant/candidates/bulk-reject', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate_ids: Array.from(selected), reason }),
    });
    setSelected(new Set());
    setActionLoading('');
    fetchCandidates();
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (loading) return <div className="flex justify-center py-20 text-gray-400">Loading...</div>;
  if (!project) return <div className="text-center py-20 text-gray-500">Project not found</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Breadcrumb & header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/digital-plant" className="hover:text-blue-600">Digital Plant</Link>
          <span>→</span>
          <span className="text-gray-900 font-medium">{project.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {project.Site.name} → {project.Plant.name} → {project.Unit.name}
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-center px-3">
              <p className="text-lg font-bold text-blue-600">{project.total_documents}</p>
              <p className="text-[10px] text-gray-400">DOCS</p>
            </div>
            <div className="text-center px-3">
              <p className="text-lg font-bold text-amber-500">{project.live_stats.pending}</p>
              <p className="text-[10px] text-gray-400">PENDING</p>
            </div>
            <div className="text-center px-3">
              <p className="text-lg font-bold text-emerald-600">{project.live_stats.approved}</p>
              <p className="text-[10px] text-gray-400">APPROVED</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-6">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t === 'documents' ? '📄 Documents' : t === 'review' ? '🔍 Review Workbench' : t === 'assets' ? '🏗️ Asset Register' : t === 'search' ? '🔎 Search' : '📥 Import'}
          </button>
        ))}
      </div>

      {/* Documents Tab */}
      {tab === 'documents' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Engineering Documents ({docTotal})</h2>
            <label className={`inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 cursor-pointer ${uploading ? 'opacity-50' : ''}`}>
              {uploading ? 'Uploading...' : '📎 Upload Document'}
              <input type="file" className="hidden" accept=".pdf,.tiff,.tif,.png,.jpg,.jpeg,.xlsx,.xls" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>

          {documents.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
              <div className="text-4xl mb-3">📄</div>
              <p className="text-gray-600 font-medium">No documents uploaded yet</p>
              <p className="text-sm text-gray-400 mt-1">Upload P&IDs, datasheets, or equipment lists</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Title</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Drawing #</th>
                    <th className="px-4 py-3 text-left">Rev</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Candidates</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{doc.title}</td>
                      <td className="px-4 py-3 text-gray-600">{doc.document_type}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{doc.drawing_number || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{doc.revision || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          doc.status === 'extracted' ? 'bg-emerald-100 text-emerald-800' :
                          doc.status === 'extracting' ? 'bg-amber-100 text-amber-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>{doc.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{doc.candidate_count}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleExtract(doc.id)}
                          disabled={doc.status === 'extracting'}
                          className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-semibold disabled:opacity-50"
                        >
                          🤖 Extract
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Review Workbench Tab */}
      {tab === 'review' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-gray-900">Review Workbench ({candTotal})</h2>
              <select
                value={candFilter}
                onChange={(e) => setCandFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="pending_review">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="merged">Merged</option>
              </select>
            </div>
            {candFilter === 'pending_review' && selected.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">{selected.size} selected</span>
                <button
                  onClick={handleBulkApprove}
                  disabled={actionLoading === 'bulk'}
                  className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 font-semibold"
                >
                  ✅ Bulk Approve
                </button>
                <button
                  onClick={handleBulkReject}
                  disabled={actionLoading === 'bulk'}
                  className="text-xs px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 font-semibold"
                >
                  ❌ Bulk Reject
                </button>
              </div>
            )}
          </div>

          {candidates.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-xl">
              <div className="text-4xl mb-3">{candFilter === 'pending_review' ? '🎉' : '📋'}</div>
              <p className="text-gray-600 font-medium">
                {candFilter === 'pending_review' ? 'No items pending review' : `No ${candFilter.replace('_', ' ')} candidates`}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {candidates.map((c) => (
                <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-all">
                  <div className="flex items-center gap-3">
                    {candFilter === 'pending_review' && (
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-gray-900">{c.tag_number}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 uppercase">
                          {c.candidate_type}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE[c.status] || ''}`}>
                          {c.status.replace('_', ' ')}
                        </span>
                        <span className={`text-xs font-semibold ${CONF_COLOR(c.confidence_score)}`}>
                          {Math.round((c.confidence_score ?? 0) * 100)}% confidence
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{c.description || 'No description'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Source: {c.source_document?.drawing_number || c.source_document?.title || '—'}
                      </p>
                    </div>
                    {candFilter === 'pending_review' && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleApprove(c.id)}
                          disabled={actionLoading === c.id}
                          className="px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100"
                        >
                          ✅ Approve
                        </button>
                        <button
                          onClick={() => handleReject(c.id)}
                          disabled={actionLoading === c.id}
                          className="px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-700 rounded-lg hover:bg-red-100"
                        >
                          ❌ Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assets Tab */}
      {tab === 'assets' && (
        <div className="text-center py-16 bg-gray-50 rounded-xl">
          <div className="text-4xl mb-3">🏗️</div>
          <p className="text-gray-600 font-medium">Asset Register</p>
          <p className="text-sm text-gray-400 mt-1">Approved assets will appear here</p>
          <Link
            href={`/digital-plant/${projectId}/assets`}
            className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            View Full Register
          </Link>
        </div>
      )}

      {/* Search Tab */}
      {tab === 'search' && (
        <div className="text-center py-16 bg-gray-50 rounded-xl">
          <div className="text-4xl mb-3">🔎</div>
          <p className="text-gray-600 font-medium">Asset Search</p>
          <Link
            href={`/digital-plant/${projectId}/search`}
            className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            Open Search
          </Link>
        </div>
      )}

      {/* Import Tab */}
      {tab === 'import' && (
        <div className="text-center py-16 bg-gray-50 rounded-xl">
          <div className="text-4xl mb-3">📥</div>
          <p className="text-gray-600 font-medium">Excel Import</p>
          <p className="text-sm text-gray-400 mt-1">Import equipment lists, valve lists, and more</p>
          <Link
            href={`/digital-plant/${projectId}/import`}
            className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            Start Import
          </Link>
        </div>
      )}
    </div>
  );
}
