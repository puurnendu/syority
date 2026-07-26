'use client';

import { useState, useEffect, useCallback } from 'react';

export function SystemProcedures({ systemId, canEdit }: { systemId: string; canEdit: boolean }) {
  const [procedures, setProcedures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(() => {
    fetch('/api/systems/' + systemId + '/procedures').then((r) => r.json()).then((d) => setProcedures(d.data ?? [])).finally(() => setLoading(false));
  }, [systemId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  async function addProcedure(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const res = await fetch(`/api/systems/${systemId}/procedures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        procedure_no: (form as any).procedure_no.value.trim(),
        title: (form as any).title.value.trim(),
        type: (form as any).type.value.trim(),
        revision: (form as any).revision.value.trim(),
        status: (form as any).status.value.trim() || 'Draft',
        owner: (form as any).owner?.value?.trim() || undefined,
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
    <div className="space-y-3">
      {canEdit && (
        <button type="button" onClick={() => setAddOpen(true)} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 mb-2">
          + Add procedure
        </button>
      )}
      {addOpen && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add procedure</h3>
            <form onSubmit={addProcedure} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Procedure no *</label><input name="procedure_no" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Type *</label><select name="type" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="Work Procedure">Work Procedure</option><option value="JSA">JSA</option><option value="MOS">MOS</option><option value="Method Statement">Method Statement</option></select></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Title *</label><input name="title" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Revision *</label><input name="revision" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Status</label><select name="status" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="Draft">Draft</option><option value="Approved">Approved</option><option value="Superseded">Superseded</option></select></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Owner</label><input name="owner" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">File URL</label><input name="file_url" type="url" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="https://..." /></div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Add</button>
                <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {procedures.length === 0 ? (
        <p className="text-gray-500 py-8">No procedures.</p>
      ) : (
        procedures.map((p) => (
          <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
            <div>
              <p className="font-mono text-sm font-medium text-gray-900">{p.procedure_no}</p>
              <p className="text-sm text-gray-700">{p.title}</p>
              <div className="flex gap-2 mt-2">
                <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">{p.type}</span>
                <span className={"px-2 py-0.5 rounded text-xs " + (p.status === 'Approved' ? 'bg-green-100 text-green-800' : p.status === 'Superseded' ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-800')}>{p.status}</span>
              </div>
              {p.owner && <p className="text-xs text-gray-500 mt-1">Owner: {p.owner}</p>}
            </div>
            {p.file_url && <a href={p.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm hover:underline">File</a>}
          </div>
        ))
      )}
    </div>
  );
}
