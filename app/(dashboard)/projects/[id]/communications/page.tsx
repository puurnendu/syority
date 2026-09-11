'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function ProjectCommunicationsPage() {
  const params = useParams<{ id: string }>();
  const [rows, setRows] = useState<any[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/projects/${params.id}/communications`);
    const json = await res.json();
    setRows(json.data ?? []);
  }

  useEffect(() => {
    load();
  }, [params.id]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/projects/${params.id}/communications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body, type: 'note' }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? 'Failed');
      return;
    }
    setSubject('');
    setBody('');
    await load();
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="text-xs text-gray-400 mb-2">
        <Link href={`/projects/${params.id}`} className="hover:underline">Project</Link> / Communications
      </div>
      <h1 className="text-2xl font-bold mb-4">Project communications</h1>
      <p className="text-sm text-gray-500 mb-4">Project-scoped notes. This is not STO WhatsApp or M16.</p>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <form onSubmit={create} className="bg-white border rounded-xl p-4 mb-6 space-y-2">
        <input className="border rounded px-2 py-1 w-full text-sm" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
        <textarea className="border rounded px-2 py-1 w-full text-sm" placeholder="Note" value={body} onChange={(e) => setBody(e.target.value)} />
        <button className="bg-indigo-600 text-white text-sm px-3 py-1.5 rounded" type="submit">Add note</button>
      </form>

      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="bg-white border rounded-xl p-4 text-sm">
            <p className="font-medium">{r.subject}</p>
            {r.body && <p className="text-gray-600 mt-1">{r.body}</p>}
            <p className="text-xs text-gray-400 mt-2">{new Date(r.created_at).toLocaleString()}</p>
          </li>
        ))}
        {rows.length === 0 && <li className="text-gray-400 text-sm">No communications yet.</li>}
      </ul>
    </div>
  );
}
