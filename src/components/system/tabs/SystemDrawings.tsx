'use client';

import { useState, useEffect, useCallback } from 'react';

export function SystemDrawings({ systemId, canEdit }: { systemId: string; canEdit: boolean }) {
  const [drawings, setDrawings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/systems/${systemId}/drawings`).then((r) => r.json()).then((d) => setDrawings(d.data ?? [])).finally(() => setLoading(false));
  }, [systemId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  async function addDrawing(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const res = await fetch(`/api/systems/${systemId}/drawings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        drawing_no: (form as any).drawing_no.value.trim(),
        title: (form as any).title.value.trim(),
        revision: (form as any).revision.value.trim(),
        type: (form as any).type.value.trim(),
        status: (form as any).status.value.trim() || 'For Review',
        file_url: (form as any).file_url?.value?.trim() || undefined,
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
      {canEdit && (
        <button type="button" onClick={() => setAddOpen(true)} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          + Add drawing
        </button>
      )}
      {addOpen && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add drawing</h3>
            <form onSubmit={addDrawing} className="space-y-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Drawing no *</label><input name="drawing_no" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Title *</label><input name="title" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Revision *</label><input name="revision" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Type *</label><select name="type" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="P&ID">P&ID</option><option value="Isometric">Isometric</option><option value="GA">GA</option><option value="Layout">Layout</option></select></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Status</label><select name="status" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="For Review">For Review</option><option value="Approved">Approved</option><option value="Superseded">Superseded</option></select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">File URL</label><input name="file_url" type="url" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="https://..." /></div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Add</button>
                <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {drawings.length === 0 ? (
          <p className="col-span-full text-center text-gray-500 py-8">No drawings.</p>
        ) : (
          drawings.map((d) => (
            <div key={d.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="font-mono text-sm font-medium text-gray-900">{d.drawing_no}</p>
              <p className="text-sm text-gray-700 mt-1">{d.title}</p>
              <p className="text-xs text-gray-500 mt-1">Rev: {d.revision} · {d.type}</p>
              <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs ${d.status === 'Approved' ? 'bg-green-100 text-green-800' : d.status === 'Superseded' ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-800'}`}>{d.status}</span>
              {d.file_url && (
                <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="block mt-2 text-blue-600 text-sm hover:underline">
                  Open file
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
