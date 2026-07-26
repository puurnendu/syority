'use client';

import { useState } from 'react';

const WBS_TYPES = ['EVENT', 'UNIT', 'SYSTEM', 'HO_WBS', 'TO_WBS', 'EQUIPMENT', 'WORKPACK', 'CUSTOM'] as const;

type ParentOption = { id: string; code: string; name: string; depth: number };

export function AddNodeModal({
  open,
  onClose,
  eventId,
  systemId,
  flatNodes,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  systemId: string;
  flatNodes: { id: string; code: string; name: string; parent_id: string | null }[];
  onAdded: () => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<(typeof WBS_TYPES)[number]>('CUSTOM');
  const [parentId, setParentId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const parentOptions: ParentOption[] = [];
  function addParents(nodes: typeof flatNodes, parentId: string | null, depth: number) {
    nodes
      .filter((n) => (n.parent_id ?? null) === parentId)
      .forEach((n) => {
        parentOptions.push({ id: n.id, code: n.code, name: n.name, depth });
        addParents(nodes, n.id, depth + 1);
      });
  }
  addParents(flatNodes, null, 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!code.trim()) {
      setError('Code is required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/systems/${systemId}/wbs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          parent_id: parentId || null,
          code: code.trim(),
          name: name.trim(),
          type,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to add node');
        return;
      }
      onAdded();
      onClose();
      setCode('');
      setName('');
      setParentId('');
      setType('CUSTOM');
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add WBS node</h3>
        {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parent</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">(Root)</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {'—'.repeat(p.depth)} {p.code} {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="e.g. TA-26.MF.1"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Node name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as (typeof WBS_TYPES)[number])}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {WBS_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Adding…' : 'Add node'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
