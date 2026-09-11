'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function ProjectStatusReportPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${params.id}/reports/status`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setData(j.data);
      });
  }, [params.id]);

  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!data) return <div className="p-6 text-gray-400">Loading report…</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="text-xs text-gray-400 mb-2">
        <Link href={`/projects/${params.id}`} className="hover:underline">Project</Link> / Reports
      </div>
      <h1 className="text-2xl font-bold">{data.project.name} — status</h1>
      <p className="text-xs text-gray-400 mb-6">Authority: {data.authority} · {data.generated_at}</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border rounded-xl p-4"><p className="text-xs text-gray-500">Progress</p><p className="text-2xl font-bold">{data.progress}%</p></div>
        <div className="bg-white border rounded-xl p-4"><p className="text-xs text-gray-500">Activities</p><p className="text-2xl font-bold">{data.counts.activities}</p></div>
        <div className="bg-white border rounded-xl p-4"><p className="text-xs text-gray-500">Critical</p><p className="text-2xl font-bold">{data.counts.critical}</p></div>
        <div className="bg-white border rounded-xl p-4"><p className="text-xs text-gray-500">Overdue</p><p className="text-2xl font-bold">{data.counts.overdue}</p></div>
      </div>

      <h2 className="font-semibold mb-2">Critical path</h2>
      <ul className="text-sm mb-6">
        {data.critical_path.map((a: any) => (
          <li key={a.id}>{a.description}</li>
        ))}
        {data.critical_path.length === 0 && <li className="text-gray-400">None calculated yet. Run Project CPM.</li>}
      </ul>

      <h2 className="font-semibold mb-2">Overdue</h2>
      <ul className="text-sm">
        {data.overdue.map((a: any) => (
          <li key={a.id}>{a.description} — {a.progress_percent}%</li>
        ))}
        {data.overdue.length === 0 && <li className="text-gray-400">None</li>}
      </ul>
    </div>
  );
}
