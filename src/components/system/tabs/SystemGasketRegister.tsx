'use client';

import { useState, useEffect, useCallback } from 'react';

export function SystemGasketRegister({ systemId, canEdit }: { systemId: string; canEdit: boolean }) {
  const [gaskets, setGaskets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(() => {
    let url = `/api/systems/${systemId}/gaskets`;
    if (statusFilter) url += `?status=${encodeURIComponent(statusFilter)}`;
    fetch(url).then((r) => r.json()).then((d) => setGaskets(d.data ?? [])).finally(() => setLoading(false));
  }, [systemId, statusFilter]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  async function addGasket(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const res = await fetch(`/api/systems/${systemId}/gaskets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gasket_id: (form as any).gasket_id.value.trim(),
        joint_ref: (form as any).joint_ref.value.trim(),
        line_number: (form as any).line_number.value.trim(),
        size: (form as any).size.value.trim(),
        pressure_rating: (form as any).pressure_rating.value.trim(),
        type: (form as any).type.value.trim(),
        material: (form as any).material.value.trim(),
        quantity: parseInt((form as any).quantity.value, 10) || 1,
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
        <input type="text" placeholder="Search…" className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-48" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All status</option>
          <option value="Required">Required</option>
          <option value="In Stock">In Stock</option>
          <option value="Installed">Installed</option>
        </select>
        {canEdit && (
          <button type="button" onClick={() => setAddOpen(true)} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            + Add gasket
          </button>
        )}
      </div>
      {addOpen && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add gasket</h3>
            <form onSubmit={addGasket} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Gasket ID *</label><input name="gasket_id" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Joint ref *</label><input name="joint_ref" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Line number *</label><input name="line_number" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Size *</label><input name="size" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Pressure rating *</label><input name="pressure_rating" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Type *</label><input name="type" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Spiral Wound / Ring Joint / Full Face" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Material *</label><input name="material" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label><input name="quantity" type="number" min={1} defaultValue={1} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gasket ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joint Ref</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Line</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {gaskets.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">No gaskets.</td>
              </tr>
            ) : (
              gaskets.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{g.gasket_id}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{g.joint_ref}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{g.line_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{g.size}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{g.pressure_rating}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{g.type}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{g.material}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{g.quantity}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${g.status === 'Installed' ? 'bg-green-100 text-green-800' : g.status === 'In Stock' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>{g.status}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
