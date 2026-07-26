'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Site = { id: string; name: string; code: string | null };
type Plant = { id: string; name: string; code: string | null; site_id: string };

export function NewUnitForm({ sites, plants }: { sites: Site[]; plants: Plant[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [plantId, setPlantId] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');

  const plantsFiltered = siteId
    ? plants.filter((p) => p.site_id === siteId)
    : plants;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!siteId || !plantId) {
      setError('Site and Plant are required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_id: siteId,
          plant_id: plantId,
          name: name.trim(),
          code: code.trim() || undefined,
          description: description.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to create unit');
        return;
      }
      router.push(`/planning/units/${json.data.id}`);
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 max-w-xl">
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
            setPlantId('');
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Plant *</label>
        {plantsFiltered.length === 0 ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            ⚠ No plants found for this site.{' '}
            <Link
              href={siteId ? `/settings/sites/${siteId}` : '/settings/hierarchy/sites'}
              className="underline font-medium"
            >
              Add a plant first
            </Link>
            {' '}before creating units.
          </div>
        ) : (
          <select
            value={plantId}
            onChange={(e) => setPlantId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          >
            <option value="">Select plant</option>
            {plantsFiltered.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.code ? ` (${p.code})` : ''}
              </option>
            ))}
          </select>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="e.g. FCCU"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="e.g. U-01"
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
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Create Unit'}
        </button>
        <Link
          href="/planning/units"
          className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
