'use client';

/**
 * M7.6H — Tenant Onboarding MVP
 *
 * Platform Admin can:
 * - View pending registration requests
 * - Filter by status (Pending / Approved / Rejected)
 * - Approve (creates Organization + Site + Admin User)
 * - Reject with notes
 */

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';

interface OnboardingRequest {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  industry: string | null;
  country: string | null;
  employeeCount: string | null;
  notes: string | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
  APPROVED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Approved' },
  REJECTED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
};

export default function OnboardingAdminPage() {
  const [requests, setRequests] = useState<OnboardingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [showReview, setShowReview] = useState<OnboardingRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/onboarding');
      if (res.ok) {
        const data = await res.json();
        setRequests(Array.isArray(data) ? data : []);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const filteredRequests = filter
    ? requests.filter((r) => r.status === filter)
    : requests;

  const statusCounts = {
    all: requests.length,
    PENDING: requests.filter((r) => r.status === 'PENDING').length,
    APPROVED: requests.filter((r) => r.status === 'APPROVED').length,
    REJECTED: requests.filter((r) => r.status === 'REJECTED').length,
  };

  async function handleReview(action: 'APPROVED' | 'REJECTED') {
    if (!showReview) return;
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: showReview.id,
          status: action,
          notes: reviewNotes || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update');
      }
      setShowReview(null);
      setReviewNotes('');
      fetchRequests();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenant Onboarding</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review and approve new organization registration requests.
          </p>
        </div>
      </div>

      {/* Status Filters */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            !filter ? 'bg-[#0D2137] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All ({statusCounts.all})
        </button>
        {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => {
          const style = STATUS_STYLES[s];
          return (
            <button
              key={s}
              onClick={() => setFilter(filter === s ? null : s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === s ? 'bg-[#0D2137] text-white' : `${style.bg} ${style.text} hover:opacity-80`
              }`}
            >
              {style.label} ({statusCounts[s]})
            </button>
          );
        })}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-20 text-gray-400 animate-pulse">Loading requests…</div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-3">📝</div>
          <h3 className="text-lg font-semibold text-gray-700">No Onboarding Requests</h3>
          <p className="text-sm text-gray-500 mt-1">
            {filter ? `No ${STATUS_STYLES[filter]?.label.toLowerCase()} requests found.` : 'New registration requests will appear here.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Company</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Industry</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Submitted</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRequests.map((req) => {
                const style = STATUS_STYLES[req.status] ?? STATUS_STYLES.PENDING;
                return (
                  <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{req.companyName}</div>
                      {req.country && <div className="text-xs text-gray-400">{req.country}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-700">{req.contactName}</div>
                      <div className="text-xs text-gray-400">{req.contactEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{req.industry ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {req.status === 'PENDING' ? (
                        <button
                          onClick={() => { setShowReview(req); setReviewNotes(''); setError(null); }}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800"
                        >
                          Review →
                        </button>
                      ) : (
                        <button
                          onClick={() => { setShowReview(req); setReviewNotes(''); setError(null); }}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          View
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Review Modal */}
      {showReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowReview(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {showReview.status === 'PENDING' ? 'Review Request' : 'Request Details'}
            </h3>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-gray-400">Company</span>
                  <p className="font-medium text-gray-900">{showReview.companyName}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">Industry</span>
                  <p className="font-medium text-gray-900">{showReview.industry ?? '—'}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">Contact Name</span>
                  <p className="font-medium text-gray-900">{showReview.contactName}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">Email</span>
                  <p className="font-medium text-gray-900">{showReview.contactEmail}</p>
                </div>
                {showReview.contactPhone && (
                  <div>
                    <span className="text-xs text-gray-400">Phone</span>
                    <p className="font-medium text-gray-900">{showReview.contactPhone}</p>
                  </div>
                )}
                {showReview.country && (
                  <div>
                    <span className="text-xs text-gray-400">Country</span>
                    <p className="font-medium text-gray-900">{showReview.country}</p>
                  </div>
                )}
                {showReview.employeeCount && (
                  <div>
                    <span className="text-xs text-gray-400">Employees</span>
                    <p className="font-medium text-gray-900">{showReview.employeeCount}</p>
                  </div>
                )}
              </div>

              {showReview.notes && (
                <div>
                  <span className="text-xs text-gray-400">Applicant Notes</span>
                  <p className="text-gray-700 bg-gray-50 rounded-lg p-3 mt-1">{showReview.notes}</p>
                </div>
              )}

              {showReview.reviewNotes && (
                <div>
                  <span className="text-xs text-gray-400">Review Notes</span>
                  <p className="text-gray-700 bg-gray-50 rounded-lg p-3 mt-1">{showReview.reviewNotes}</p>
                </div>
              )}

              {showReview.status === 'PENDING' && (
                <>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Review Notes (optional)</label>
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Add notes about this decision..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 min-h-[80px]"
                    />
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-xs">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => handleReview('APPROVED')}
                      disabled={processing}
                      className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {processing ? 'Processing…' : '✓ Approve & Create Tenant'}
                    </button>
                    <button
                      onClick={() => handleReview('REJECTED')}
                      disabled={processing}
                      className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      {processing ? 'Processing…' : '✕ Reject'}
                    </button>
                  </div>
                </>
              )}

              {showReview.status !== 'PENDING' && (
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setShowReview(null)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
