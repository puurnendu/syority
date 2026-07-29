'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ScopeComparePage() {
  const [scopes, setScopes] = useState<any[]>([]);
  const [scopeAId, setScopeAId] = useState('');
  const [scopeBId, setScopeBId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'added' | 'removed' | 'deferred' | 'same'>('added');

  useEffect(() => {
    fetch('/api/shutdown-scope/scopes?page_size=100').then((r) => r.json()).then((d) => setScopes(d.data || []));
  }, []);

  const compare = async () => {
    if (!scopeAId || !scopeBId) return;
    setLoading(true);
    const res = await fetch('/api/shutdown-scope/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope_a_id: scopeAId, scope_b_id: scopeBId }),
    });
    setResult(await res.json());
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/shutdown-scope" className="text-xs text-blue-600 hover:underline">← Back to Scopes</Link>
        <h1 className="text-xl font-bold text-gray-900 mt-1">🔄 TA Scope Comparison</h1>
        <p className="text-sm text-gray-500">Compare scope between two shutdowns</p>
      </div>

      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Previous TA (A)</label>
          <select value={scopeAId} onChange={(e) => setScopeAId(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
            <option value="">Select scope...</option>
            {scopes.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.event?.code}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Current TA (B)</label>
          <select value={scopeBId} onChange={(e) => setScopeBId(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
            <option value="">Select scope...</option>
            {scopes.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.event?.code}</option>)}
          </select>
        </div>
        <button onClick={compare} disabled={loading || !scopeAId || !scopeBId} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Comparing...' : 'Compare'}
        </button>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-4 gap-3">
            {[
              { key: 'added', label: 'Added', count: result.summary.added, color: 'green' },
              { key: 'removed', label: 'Removed', count: result.summary.removed, color: 'red' },
              { key: 'deferred', label: 'Deferred', count: result.summary.deferred, color: 'amber' },
              { key: 'same', label: 'Same', count: result.summary.same, color: 'gray' },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setTab(s.key as any)}
                className={`p-3 rounded-xl text-center border ${tab === s.key ? 'ring-2 ring-blue-500' : ''}`}
              >
                <div className="text-2xl font-bold">{s.count}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </button>
            ))}
          </div>

          <div className="bg-white border rounded-xl p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Asset Tag</th>
                  <th className="px-3 py-2 text-left">Asset Name</th>
                  <th className="px-3 py-2">Discipline</th>
                  {(tab === 'added' || tab === 'removed' || tab === 'deferred') && <th className="px-3 py-2 text-left">Reason</th>}
                  {tab === 'added' && <th className="px-3 py-2">Priority</th>}
                  {tab === 'added' && <th className="px-3 py-2">Hours</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {(result.detail?.[tab] || []).map((item: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs">{item.tag}</td>
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2 text-center">{item.discipline || '—'}</td>
                    {(tab === 'added' || tab === 'removed' || tab === 'deferred') && <td className="px-3 py-2 text-gray-600 max-w-xs truncate">{item.reason}</td>}
                    {tab === 'added' && <td className="px-3 py-2 text-center">{item.priority}</td>}
                    {tab === 'added' && <td className="px-3 py-2 text-center">{item.estimated_hours}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
