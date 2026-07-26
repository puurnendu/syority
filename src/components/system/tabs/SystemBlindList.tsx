'use client';

import { useState, useEffect, useCallback } from 'react';

export function SystemBlindList({ systemId, canEdit }: { systemId: string; canEdit: boolean }) {
  const [blinds, setBlinds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(() => {
    const url = statusFilter ? `/api/systems/${systemId}/blinds?status=${encodeURIComponent(statusFilter)}` : `/api/systems/${systemId}/blinds`;
    fetch(url).then((r) => r.json()).then((d) => setBlinds(d.data ?? [])).finally(() => setLoading(false));
  }, [systemId, statusFilter]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  async function updateStatus(blindId: string, status: string) {
    if (!canEdit) return;
    const body: any = { status };
    if (status === 'Inserted') body.inserted_at = new Date().toISOString();
    if (status === 'Removed') body.removed_at = new Date().toISOString();
    const res = await fetch(`/api/systems/${systemId}/blinds/${blindId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) {
      const json = await res.json();
      setBlinds((prev) => prev.map((b) => (b.id === blindId ? json.data : b)));
    }
  }

  async function addBlind(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const res = await fetch(`/api/systems/${systemId}/blinds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blind_id: (form as any).blind_id.value.trim(),
        tag: (form as any).tag.value.trim(),
        line_number: (form as any).line_number.value.trim(),
        spec: (form as any).spec.value.trim(),
        size: (form as any).size.value.trim(),
        material: (form as any).material.value.trim(),
      }),
    });
    if (res.ok) {
      setAddOpen(false);
      load();
    }
  }

  if (loading) return <div className="text-gray-500">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
        <option value="">All status</option>
        <option value="Pending">Pending</option>
        <option value="Inserted">Inserted</option>
        <option value="Removed">Removed</option>
      </select>
        {canEdit && (
          <button type="button" onClick={() => setAddOpen(true)} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            + Add blind
          </button>
        )}
      </div>
      {addOpen && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add blind</h3>
            <form onSubmit={addBlind} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Blind ID *</label><input name="blind_id" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="BL-001" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Tag *</label><input name="tag" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Equipment tag" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Line number *</label><input name="line_number" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Spec *</label><input name="spec" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Size *</label><input name="size" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Material *</label><input name="material" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Add</button>
                <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Blind ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tag</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Line</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Spec</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inserted</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Removed</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              {canEdit && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {blinds.length === 0 ? (
              <tr><td colSpan={canEdit ? 10 : 9} className="px-4 py-8 text-center text-gray-500">No blinds.</td></tr>
            ) : (
              blinds.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{b.blind_id}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{b.tag}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{b.line_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{b.spec}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{b.size}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{b.material}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{b.inserted_at ? new Date(b.inserted_at).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{b.removed_at ? new Date(b.removed_at).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={"px-2 py-0.5 rounded text-xs " + (b.status === 'Inserted' ? 'bg-green-100 text-green-800' : b.status === 'Removed' ? 'bg-gray-100 text-gray-700' : 'bg-amber-100 text-amber-800')}>{b.status}</span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      {b.status !== 'Inserted' && <button type="button" onClick={() => updateStatus(b.id, 'Inserted')} className="text-green-600 text-xs font-medium hover:underline mr-2">Mark Inserted</button>}
                      {b.status !== 'Removed' && <button type="button" onClick={() => updateStatus(b.id, 'Removed')} className="text-gray-600 text-xs font-medium hover:underline">Mark Removed</button>}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
