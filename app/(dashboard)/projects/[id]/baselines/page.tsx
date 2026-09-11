'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function ProjectBaselinesPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [rows, setRows] = useState<any[]>([]);
  const [compare, setCompare] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');

  async function load() {
    const res = await fetch(`/api/projects/${projectId}/baseline`);
    const json = await res.json();
    setRows(json.data ?? []);
  }

  useEffect(() => {
    load();
  }, [projectId]);

  async function create() {
    const res = await fetch(`/api/projects/${projectId}/baseline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name || undefined }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? 'Failed to create baseline');
      return;
    }
    setName('');
    await load();
  }

  async function runCompare(id: string) {
    const res = await fetch(`/api/projects/${projectId}/baseline/compare?baselineId=${id}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? 'Compare failed');
      return;
    }
    setCompare(json.data);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="text-xs text-gray-400 mb-2">
        <Link href={`/projects/${projectId}`} className="hover:underline">Project</Link> / Baselines
      </div>
      <h1 className="text-2xl font-bold mb-4">Project baselines</h1>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="flex gap-2 mb-6">
        <input className="border rounded px-2 py-1 text-sm" placeholder="Baseline name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="bg-indigo-600 text-white text-sm px-3 py-1.5 rounded" onClick={create}>Snapshot current schedule</button>
      </div>

      <ul className="bg-white border rounded-xl divide-y mb-6">
        {rows.map((b) => (
          <li key={b.id} className="px-4 py-2 text-sm flex justify-between">
            <span>{b.name} {b.is_current ? '(current)' : ''} · {b._count?.baselineActivities ?? 0} activities</span>
            <button className="text-indigo-600" onClick={() => runCompare(b.id)}>Compare</button>
          </li>
        ))}
        {rows.length === 0 && <li className="px-4 py-8 text-center text-gray-400">No baselines yet.</li>}
      </ul>

      {compare && (
        <div className="bg-white border rounded-xl p-4 text-sm">
          <p className="font-semibold mb-2">
            vs {compare.baseline.name} · mean finish variance {compare.mean_finish_variance_days ?? '—'}d
          </p>
          <table className="w-full">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="py-1">Activity</th>
                <th>Start Δ</th>
                <th>Finish Δ</th>
                <th>Float Δ</th>
              </tr>
            </thead>
            <tbody>
              {compare.rows.slice(0, 40).map((r: any) => (
                <tr key={r.activity_id} className="border-t">
                  <td className="py-1">{r.description}</td>
                  <td>{r.start_variance_days ?? '—'}</td>
                  <td>{r.finish_variance_days ?? '—'}</td>
                  <td>{r.float_variance ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
