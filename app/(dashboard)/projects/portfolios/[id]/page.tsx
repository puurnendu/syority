'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function PortfolioDashboardPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/portfolios/${params.id}/dashboard`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setData(j.data);
      });
  }, [params.id]);

  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!data) return <div className="p-6 text-gray-400">Loading portfolio…</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="text-xs text-gray-400 mb-2">
        <Link href="/projects/portfolios" className="hover:underline">Portfolios</Link>
        <span> / {data.portfolio.name}</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900">{data.portfolio.name}</h1>
      <p className="text-sm text-gray-500 font-mono mb-6">{data.portfolio.code}</p>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          ['Projects', data.counts.projects],
          ['Active', data.counts.active],
          ['Completed', data.counts.completed],
          ['Delayed', data.counts.delayed],
          ['At risk', data.counts.at_risk],
        ].map(([label, value]) => (
          <div key={label} className="bg-white border rounded-xl p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Portfolio progress (mean of project activity %): <strong>{data.portfolio_progress}%</strong>
        {data.mean_finish_variance_days != null && (
          <> · Mean finish variance: <strong>{data.mean_finish_variance_days}d</strong></>
        )}
      </p>

      <div className="bg-white border rounded-xl overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">Project</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Progress</th>
              <th className="px-4 py-2">Health</th>
            </tr>
          </thead>
          <tbody>
            {data.project_health.map((p: any) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2">
                  <Link href={`/projects/${p.id}`} className="text-indigo-600 hover:underline">{p.name}</Link>
                  <span className="text-gray-400 font-mono ml-2">{p.code}</span>
                </td>
                <td className="px-4 py-2">{p.status}</td>
                <td className="px-4 py-2">{p.progress}%</td>
                <td className="px-4 py-2">{p.delayed ? 'Delayed' : 'On track'}</td>
              </tr>
            ))}
            {data.project_health.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No projects in this portfolio.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="font-semibold mb-2">Upcoming finishes</h2>
      <ul className="text-sm text-gray-700 space-y-1">
        {data.upcoming_milestones.map((m: any) => (
          <li key={m.project_id}>
            {m.project_name} — {m.date ? new Date(m.date).toLocaleDateString() : '—'}
          </li>
        ))}
        {data.upcoming_milestones.length === 0 && <li className="text-gray-400">None</li>}
      </ul>
    </div>
  );
}
