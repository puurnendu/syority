'use client';

import { useState, useEffect, useCallback } from 'react';

export function SystemOverview({ system, canEdit }: { system: any; canEdit: boolean }) {
  const [linkedEvents, setLinkedEvents] = useState<any[]>([]);
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [linkEventId, setLinkEventId] = useState('');
  const [loadingEvents, setLoadingEvents] = useState(false);

  const loadLinked = useCallback(() => {
    fetch(`/api/systems/${system.id}/events`).then((r) => r.json()).then((d) => setLinkedEvents(d.data ?? []));
  }, [system.id]);

  useEffect(() => {
    loadLinked();
    fetch('/api/events').then((r) => r.json()).then((d) => setAllEvents(d.data ?? [])).catch(() => {});
  }, [loadLinked]);

  const linkToEvent = async () => {
    if (!linkEventId || !canEdit) return;
    setLoadingEvents(true);
    const res = await fetch(`/api/systems/${system.id}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: linkEventId }),
    });
    if (res.ok) {
      setLinkEventId('');
      loadLinked();
    }
    setLoadingEvents(false);
  };

  const unlinkEvent = async (eventId: string) => {
    if (!canEdit) return;
    const res = await fetch(`/api/systems/${system.id}/events/${eventId}`, { method: 'DELETE' });
    if (res.ok) loadLinked();
  };

  const alreadyLinked = linkedEvents.map((e) => e.id);
  const availableEvents = allEvents.filter((e) => !alreadyLinked.includes(e.id));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Engineering data</h3>
        </div>
        <div className="p-6">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><dt className="text-xs font-medium text-gray-500 uppercase">Code</dt><dd className="mt-1 text-sm text-gray-900">{system.code ?? '—'}</dd></div>
            <div><dt className="text-xs font-medium text-gray-500 uppercase">Name</dt><dd className="mt-1 text-sm text-gray-900">{system.name}</dd></div>
            <div><dt className="text-xs font-medium text-gray-500 uppercase">Unit</dt><dd className="mt-1 text-sm text-gray-900">{system.unit?.name ?? '—'}</dd></div>
            <div><dt className="text-xs font-medium text-gray-500 uppercase">Site</dt><dd className="mt-1 text-sm text-gray-900">{system.site?.name ?? '—'}</dd></div>
            <div><dt className="text-xs font-medium text-gray-500 uppercase">Criticality</dt><dd className="mt-1 text-sm text-gray-900">{system.criticality ?? '—'}</dd></div>
            <div><dt className="text-xs font-medium text-gray-500 uppercase">Status</dt><dd className="mt-1 text-sm text-gray-900">{system.status}</dd></div>
            <div><dt className="text-xs font-medium text-gray-500 uppercase">P&ID reference</dt><dd className="mt-1 text-sm text-gray-900">{system.p_and_id_ref ?? '—'}</dd></div>
          </dl>
        </div>
      </div>
      {system.description && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-900">Description</h3></div>
          <div className="p-6"><p className="text-sm text-gray-700 whitespace-pre-wrap">{system.description}</p></div>
        </div>
      )}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Summary</h3>
        <div className="flex flex-wrap gap-6 text-sm">
          <span><strong>{system._count?.blinds ?? 0}</strong> Blinds</span>
          <span><strong>{system._count?.gaskets ?? 0}</strong> Gaskets</span>
          <span><strong>{system._count?.workpacks ?? 0}</strong> Workpacks</span>
          <span><strong>{system._count?.line_lists ?? 0}</strong> Lines</span>
          <span><strong>{system._count?.assets ?? 0}</strong> Equipment</span>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Linked events</h3>
          {canEdit && availableEvents.length > 0 && (
            <div className="flex gap-2">
              <select value={linkEventId} onChange={(e) => setLinkEventId(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
                <option value="">Select event…</option>
                {availableEvents.map((e) => (
                  <option key={e.id} value={e.id}>{e.code} – {e.name}</option>
                ))}
              </select>
              <button type="button" onClick={linkToEvent} disabled={!linkEventId || loadingEvents} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">Link</button>
            </div>
          )}
        </div>
        <div className="p-6">
          {linkedEvents.length === 0 ? (
            <p className="text-sm text-gray-500">Not linked to any event. Link this system to an event so it appears when filtering by event on the Systems list.</p>
          ) : (
            <ul className="space-y-2">
              {linkedEvents.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                  <span className="text-sm font-medium text-gray-900">{e.code}</span>
                  <span className="text-sm text-gray-600">{e.name}</span>
                  <span className="text-xs text-gray-500">{e.status}</span>
                  {canEdit && (
                    <button type="button" onClick={() => unlinkEvent(e.id)} className="text-xs text-red-600 hover:underline">Unlink</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
