'use client';

import { useState } from 'react';

export interface PlannedDateOverrideDialogProps {
  activityId: string;
  field: 'planned_start' | 'planned_end';
  label: string;
  currentValue: string | null;
  derivedValue: string | null;
  onClose: () => void;
  onApplied: () => void;
}

function toLocalInput(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PlannedDateOverrideDialog({
  activityId,
  field,
  label,
  currentValue,
  derivedValue,
  onClose,
  onApplied,
}: PlannedDateOverrideDialogProps) {
  const [value, setValue] = useState(toLocalInput(currentValue));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason.trim()) {
      setError('A reason is required to override a CPM-derived date.');
      return;
    }
    if (!value) {
      setError('Choose the override date and time.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/activities/${activityId}/planned-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: reason.trim(),
          source: 'ui',
          [field]: new Date(value).toISOString(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Override was rejected');
        return;
      }
      onApplied();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Override failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-none border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-bold text-gray-900">Override {label}</h2>
        <p className="mt-1 text-xs text-gray-500">
          CPM-derived value is preserved. This pin is audited with your reason, user and timestamp.
        </p>
        {derivedValue && (
          <p className="mt-2 text-xs text-gray-600">
            Derived: <span className="font-mono">{new Date(derivedValue).toLocaleString()}</span>
          </p>
        )}
        <label className="mt-3 block text-xs font-semibold text-gray-700">
          Override date
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="mt-3 block text-xs font-semibold text-gray-700">
          Reason (required)
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Why CPM must not own this date"
          />
        </label>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs font-bold text-gray-600">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Record override'}
          </button>
        </div>
      </div>
    </div>
  );
}
