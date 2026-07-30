'use client';

/**
 * M7.6G.1 — Seed Pack Management
 *
 * Catalog of reusable seed packs. Execute, clone, export, import.
 */

import { useState, useCallback } from 'react';
import useSWR, { mutate } from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
};

const CATEGORY_ICONS: Record<string, string> = {
  demo: '🏭', training: '📚', pilot: '🚀', internal: '🔧', custom: '✨',
};

const STATUS_COLORS: Record<string, string> = {
  ready: '#10b981', draft: '#f59e0b', archived: '#6b7280',
};

export default function SeedPacksPage() {
  const { data, error, isLoading } = useSWR('/api/admin/seed-packs', fetcher);
  const [executing, setExecuting] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [showPreview, setShowPreview] = useState<any>(null);
  const [overrideSlug, setOverrideSlug] = useState('');
  const [overrideName, setOverrideName] = useState('');

  const seedBuiltins = useCallback(async () => {
    await fetch('/api/admin/seed-packs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'seed' }),
    });
    mutate('/api/admin/seed-packs');
  }, []);

  const executePack = useCallback(async (packId: string) => {
    setExecuting(packId);
    setResult(null);
    try {
      const res = await fetch('/api/admin/seed-packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          packId,
          slug: overrideSlug || undefined,
          name: overrideName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      mutate('/api/admin/seed-packs');
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setExecuting(null);
      setOverrideSlug('');
      setOverrideName('');
    }
  }, [overrideSlug, overrideName]);

  const previewPack = useCallback(async (packId: string) => {
    const res = await fetch('/api/admin/seed-packs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'preview', packId }),
    });
    const data = await res.json();
    setShowPreview(data.preview);
  }, []);

  const clonePack = useCallback(async (packId: string, slug: string) => {
    const newSlug = prompt('Enter slug for cloned pack:', `${slug}-copy`);
    if (!newSlug) return;
    await fetch('/api/admin/seed-packs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clone', packId, newSlug }),
    });
    mutate('/api/admin/seed-packs');
  }, []);

  const exportPack = useCallback(async (packId: string) => {
    const res = await fetch(`/api/admin/seed-packs/${packId}`);
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data.pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seed-pack-${data.pack.slug}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const packs = data?.packs ?? [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Seed Packs</h1>
          <p className="text-sm text-gray-500 mt-1">Provision organizations with demo data</p>
        </div>
        <button
          onClick={seedBuiltins}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition"
        >
          Initialize Built-in Packs
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className={`rounded-xl p-5 border ${result.error ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          {result.error ? (
            <p className="text-sm text-red-700">❌ {result.error}</p>
          ) : (
            <div>
              <p className="text-sm font-medium text-green-800">✅ Seed pack executed successfully</p>
              <p className="text-xs text-green-600 mt-1">{result.recordsCreated} records created</p>
              {result.log && (
                <div className="mt-3 space-y-1">
                  {result.log.map((line: string, i: number) => (
                    <p key={i} className="text-xs text-green-700 font-mono">{line}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Preview</h3>
            <button onClick={() => setShowPreview(null)} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {Object.entries(showPreview).map(([key, val]) => (
              <div key={key} className="bg-gray-50 rounded-lg p-3">
                <span className="text-xs text-gray-400 block capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                <span className="text-lg font-bold text-gray-900">{val as number}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Override Slug/Name for execution */}
      <div className="bg-gray-50 rounded-xl p-4 flex gap-4">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Override Slug (optional)</label>
          <input
            value={overrideSlug}
            onChange={(e) => setOverrideSlug(e.target.value)}
            placeholder="custom-org-slug"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Override Name (optional)</label>
          <input
            value={overrideName}
            onChange={(e) => setOverrideName(e.target.value)}
            placeholder="Custom Org Name"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* Pack Grid */}
      {isLoading ? (
        <div className="text-gray-500 animate-pulse">Loading seed packs...</div>
      ) : error ? (
        <div className="text-red-500">Failed to load. Initialize built-in packs first.</div>
      ) : packs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <p className="text-sm text-gray-500">No seed packs found. Click "Initialize Built-in Packs" to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packs.map((pack: any) => (
            <div key={pack.id} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-sm transition">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{CATEGORY_ICONS[pack.category] ?? '📦'}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{pack.name}</h3>
                    <span className="text-xs text-gray-400 font-mono">{pack.slug}</span>
                  </div>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: `${STATUS_COLORS[pack.status] ?? '#6b7280'}15`,
                    color: STATUS_COLORS[pack.status] ?? '#6b7280',
                  }}
                >
                  {pack.status}
                </span>
              </div>

              {/* Description */}
              {pack.description && (
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{pack.description}</p>
              )}

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
                <span>~{pack.estimated_records} records</span>
                <span>~{pack.estimated_time_seconds}s</span>
                <span>v{pack.version}</span>
              </div>

              {/* Recent Executions */}
              {pack.executions?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-gray-400 mb-1">Recent executions:</p>
                  {pack.executions.slice(0, 2).map((ex: any) => (
                    <div key={ex.id} className="flex items-center justify-between text-xs py-0.5">
                      <span className={ex.status === 'completed' ? 'text-green-600' : ex.status === 'failed' ? 'text-red-600' : 'text-yellow-600'}>
                        {ex.status === 'completed' ? '✅' : ex.status === 'failed' ? '❌' : '⏳'} {ex.status}
                      </span>
                      <span className="text-gray-400">{ex.records_created} records</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => executePack(pack.id)}
                  disabled={executing === pack.id || pack.status !== 'ready'}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {executing === pack.id ? 'Running...' : '▶ Execute'}
                </button>
                <button
                  onClick={() => previewPack(pack.id)}
                  className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50 transition"
                >
                  Preview
                </button>
                <button
                  onClick={() => clonePack(pack.id, pack.slug)}
                  className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50 transition"
                >
                  Clone
                </button>
                <button
                  onClick={() => exportPack(pack.id)}
                  className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50 transition"
                >
                  Export
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
