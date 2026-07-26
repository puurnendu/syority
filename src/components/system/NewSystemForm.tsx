'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';

type Site = { id: string; name: string; code: string | null };
type Unit = { id: string; name: string; code: string | null; site_id: string };

function getInitialUnitAndSite(
  units: Unit[],
  sites: Site[],
  preselectedUnitId?: string
): { unitId: string; siteId: string } {
  if (!preselectedUnitId) {
    return { unitId: '', siteId: sites[0]?.id ?? '' };
  }
  const unit = units.find((u) => u.id === preselectedUnitId);
  if (!unit) return { unitId: '', siteId: sites[0]?.id ?? '' };
  return { unitId: unit.id, siteId: unit.site_id };
}

export function NewSystemForm({
  sites,
  units,
  preselectedUnitId,
}: {
  sites: Site[];
  units: Unit[];
  preselectedUnitId?: string;
}) {
  const router = useRouter();
  const { unitId: initialUnitId, siteId: initialSiteId } = useMemo(
    () => getInitialUnitAndSite(units, sites, preselectedUnitId),
    [units, sites, preselectedUnitId]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [siteId, setSiteId] = useState(initialSiteId);
  const [unitId, setUnitId] = useState(initialUnitId);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [criticality, setCriticality] = useState('');
  const [status, setStatus] = useState('Active');
  const [pAndIdRef, setPAndIdRef] = useState('');

  const unitsForSite = units.filter((u) => u.site_id === siteId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!siteId || !unitId) {
      setError('Site and Unit are required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/systems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_id: siteId,
          unit_id: unitId,
          code: code.trim() || undefined,
          name: name.trim(),
          description: description.trim() || undefined,
          criticality: criticality || undefined,
          status,
          p_and_id_ref: pAndIdRef.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to create system');
        return;
      }
      router.push(`/planning/systems/${json.data.id}`);
      router.refresh();
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">
          {error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Site *</label>
        <select
          value={siteId}
          onChange={(e) => {
            setSiteId(e.target.value);
            setUnitId('');
          }}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          required
        >
          <option value="">Select site</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
        {!siteId ? (
          <select
            disabled
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50"
          >
            <option>Select site first</option>
          </select>
        ) : unitsForSite.length === 0 ? (
          <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl shadow-sm space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-900">No units found for this site</h4>
                <p className="text-xs text-amber-700 leading-relaxed mt-0.5">
                  Systems must belong to a unit. Please create a unit for <strong>{sites.find(s => s.id === siteId)?.name}</strong> before you can add a system.
                </p>
              </div>
            </div>
            <div className="pt-1">
              <a 
                href="/planning/units/new" 
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-all hover:shadow-md active:scale-95"
              >
                <span>+ Create New Unit</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </a>
            </div>
          </div>
        ) : (
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          >
            <option value="">Select unit</option>
            {unitsForSite.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="e.g. MF, HP-STM"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="e.g. Main Fractionator"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          rows={2}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Criticality</label>
          <select
            value={criticality}
            onChange={(e) => setCriticality(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">P&amp;ID reference</label>
        <input
          type="text"
          value={pAndIdRef}
          onChange={(e) => setPAndIdRef(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Create System'}
        </button>
        <a
          href={preselectedUnitId ? `/planning/units/${preselectedUnitId}` : '/planning/systems'}
          className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
