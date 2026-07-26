'use client';

import { useState } from 'react';

type ApprovalStatus =
  | 'not_submitted'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'revision_requested';

const STATUS_CONFIG: Record<
  ApprovalStatus,
  { label: string; color: string; dot: string; icon: string }
> = {
  not_submitted: {
    label: 'Not Submitted',
    color: 'bg-gray-100 text-gray-600 border-gray-200',
    dot: 'bg-gray-400',
    icon: '○',
  },
  submitted: {
    label: 'Submitted for Approval',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    icon: '⏳',
  },
  approved: {
    label: 'Approved',
    color: 'bg-green-50 text-green-700 border-green-200',
    dot: 'bg-green-500',
    icon: '✓',
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-red-50 text-red-700 border-red-200',
    dot: 'bg-red-500',
    icon: '✗',
  },
  revision_requested: {
    label: 'Revision Requested',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    icon: '↺',
  },
};

export function ApprovalStatusBar({
  workpackId,
  initialStatus,
  initialApprovedByName,
  initialApprovedByEmail,
  initialNotes,
  canEdit,
}: {
  workpackId: string;
  initialStatus: ApprovalStatus | null | undefined;
  initialApprovedByName?: string | null;
  initialApprovedByEmail?: string | null;
  initialNotes?: string | null;
  canEdit: boolean;
}) {
  const [status, setStatus] = useState<ApprovalStatus>(
    (initialStatus as ApprovalStatus) ?? 'not_submitted'
  );
  const [approvedByName, setApprovedByName] = useState(
    initialApprovedByName ?? ''
  );
  const [approvedByEmail, setApprovedByEmail] = useState(
    initialApprovedByEmail ?? ''
  );
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_submitted;

  async function handleSave(newStatus: ApprovalStatus) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/workpacks/${workpackId}/approval`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approval_status: newStatus,
          approved_by_name: approvedByName || null,
          approved_by_email: approvedByEmail || null,
          approval_notes: notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatus(newStatus);
      setShowModal(false);
      window.location.reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-full ${config.color}`}
        >
          <span>{config.icon}</span>
          <span>{config.label}</span>
          {initialApprovedByName && status === 'approved' && (
            <span className="opacity-70">— {initialApprovedByName}</span>
          )}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2"
          >
            Update
          </button>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">
                Update Approval Status
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Record the client&apos;s decision manually after receiving their
                response by email.
              </p>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2 block">
                  Status
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {(
                    Object.entries(STATUS_CONFIG) as [
                      ApprovalStatus,
                      (typeof STATUS_CONFIG)[ApprovalStatus],
                    ][]
                  ).map(([s, cfg]) => (
                    <label
                      key={s}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        status === s
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="status"
                        value={s}
                        checked={status === s}
                        onChange={() => setStatus(s)}
                        className="text-blue-600"
                      />
                      <span
                        className={`text-sm font-medium ${
                          status === s ? 'text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        {cfg.icon} {cfg.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {status !== 'not_submitted' && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">
                      Client Contact Name
                    </label>
                    <input
                      type="text"
                      value={approvedByName}
                      onChange={(e) => setApprovedByName(e.target.value)}
                      placeholder="e.g. John Smith"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">
                      Client Email
                    </label>
                    <input
                      type="email"
                      value={approvedByEmail}
                      onChange={(e) => setApprovedByEmail(e.target.value)}
                      placeholder="e.g. john.smith@client.com"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Notes / Comments
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any comments from the client..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-between">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSave(status)}
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Status'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
