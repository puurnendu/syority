'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type Node = {
  id: string;
  parent_id: string | null;
  code: string;
  name: string;
  order: number;
  depth: number;
};

export default function ProjectWbsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [flat, setFlat] = useState<Node[]>([]);
  const [name, setName] = useState('New WBS Node');
  const [parentId, setParentId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/projects/${projectId}/wbs`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? 'Failed to load WBS');
      return;
    }
    setFlat(json.flat ?? json.data ?? []);
  }

  useEffect(() => {
    load();
  }, [projectId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/projects/${projectId}/wbs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parent_id: parentId || null }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? 'Failed to add node');
      return;
    }
    setName('New WBS Node');
    await load();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/projects/${projectId}/wbs/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? 'Failed to delete');
      return;
    }
    await load();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="text-xs text-gray-400 mb-2">
        <Link href={`/projects/${projectId}`} className="hover:underline">Project</Link> / WBS
      </div>
      <h1 className="text-2xl font-bold mb-4">Project WBS</h1>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <form onSubmit={add} className="flex flex-wrap gap-2 items-end mb-6">
        <input className="border rounded px-2 py-1 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="border rounded px-2 py-1 text-sm" value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">Root</option>
          {flat.map((n) => (
            <option key={n.id} value={n.id}>{'—'.repeat(n.depth)} {n.code} {n.name}</option>
          ))}
        </select>
        <button className="bg-indigo-600 text-white text-sm px-3 py-1.5 rounded" type="submit">Add node</button>
      </form>

      <ul className="bg-white border rounded-xl divide-y">
        {flat.map((n) => (
          <li key={n.id} className="px-4 py-2 flex justify-between items-center text-sm" style={{ paddingLeft: 16 + n.depth * 16 }}>
            <span><span className="font-mono text-gray-400 mr-2">{n.code}</span>{n.name}</span>
            <button className="text-red-600 text-xs" onClick={() => remove(n.id)}>Delete</button>
          </li>
        ))}
        {flat.length === 0 && <li className="px-4 py-8 text-center text-gray-400">No WBS nodes yet.</li>}
      </ul>
    </div>
  );
}
