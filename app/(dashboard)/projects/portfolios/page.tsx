'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Portfolio = {
  id: string;
  name: string;
  code: string;
  status: string;
  category: string | null;
  _count?: { projects: number };
};

export default function PortfoliosPage() {
  const [rows, setRows] = useState<Portfolio[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/portfolios');
    const json = await res.json();
    setRows(json.data ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/portfolios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, code }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? 'Failed to create portfolio');
      return;
    }
    setName('');
    setCode('');
    await load();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Portfolios</h1>
      <p className="text-sm text-gray-500 mb-6">
        General project portfolios. Independent of STO Events.
      </p>

      <form onSubmit={create} className="bg-white border rounded-xl p-4 mb-6 flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          <span className="block text-gray-500 mb-1">Name</span>
          <input className="border rounded px-2 py-1" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="text-sm">
          <span className="block text-gray-500 mb-1">Code</span>
          <input className="border rounded px-2 py-1" value={code} onChange={(e) => setCode(e.target.value)} required />
        </label>
        <button type="submit" className="bg-indigo-600 text-white text-sm px-3 py-1.5 rounded">
          Create portfolio
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Projects</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2">
                  <Link href={`/projects/portfolios/${p.id}`} className="text-indigo-600 hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-2 font-mono">{p.code}</td>
                <td className="px-4 py-2">{p.status}</td>
                <td className="px-4 py-2">{p._count?.projects ?? 0}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  No portfolios yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
