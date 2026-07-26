'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const DISCIPLINES = ['Mechanical', 'Electrical', 'Instrumentation', 'Civil', 'Process', 'Other'];
const IMPACTS = ['Critical', 'High', 'Medium', 'Low'];

const HEAT = (n: number): string =>
  n === 0
    ? 'bg-gray-50 text-gray-300'
    : n === 1
      ? 'bg-yellow-100 text-yellow-800'
      : n <= 3
        ? 'bg-orange-200 text-orange-900'
        : n <= 6
          ? 'bg-red-300 text-red-900'
          : 'bg-red-600 text-white';

export default function ProjectConstraintsPage() {
  const params = useParams();
  const projectId = params?.id as string;
  const [constraints, setConstraints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    fetch(`/api/projects/${projectId}/constraints`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => setConstraints(Array.isArray(d.data) ? d.data : []))
      .catch(() => setConstraints([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  const openConstraints = constraints.filter((c) => (c.status ?? 'Open') === 'Open');
  const matrix = DISCIPLINES.reduce(
    (acc, d) => {
      acc[d] = IMPACTS.reduce((a2, imp) => {
        a2[imp] = openConstraints.filter(
          (c) => (c.discipline ?? 'Other') === d && (c.impact ?? 'Medium') === imp
        ).length;
        return a2;
      }, {} as Record<string, number>);
      return acc;
    },
    {} as Record<string, Record<string, number>>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Constraints</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Open constraints for this project — discipline × impact
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Total open</p>
          <p className="text-2xl font-bold text-gray-900">{openConstraints.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Critical</p>
          <p className="text-2xl font-bold text-red-600">
            {openConstraints.filter((c) => (c.impact ?? '') === 'Critical').length}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">High</p>
          <p className="text-2xl font-bold text-amber-600">
            {openConstraints.filter((c) => (c.impact ?? '') === 'High').length}
          </p>
        </div>
      </div>

      <div className="mt-6 bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Open Constraints — Discipline × Impact
        </h3>
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="text-left text-gray-400 font-medium pb-2 pr-4 w-32">
                  Discipline
                </th>
                {IMPACTS.map((i) => (
                  <th key={i} className="text-center text-gray-500 font-medium pb-2 w-20">
                    {i}
                  </th>
                ))}
                <th className="text-center text-gray-400 font-medium pb-2 w-16">Total</th>
              </tr>
            </thead>
            <tbody>
              {DISCIPLINES.map((disc) => (
                <tr key={disc}>
                  <td className="text-gray-700 font-medium pr-4 py-1">{disc}</td>
                  {IMPACTS.map((imp) => {
                    const n = matrix[disc]?.[imp] ?? 0;
                    return (
                      <td key={imp} className="py-1 px-1 text-center">
                        <div
                          className={`rounded-lg w-16 h-8 flex items-center justify-center font-bold mx-auto ${HEAT(n)}`}
                        >
                          {n > 0 ? n : '—'}
                        </div>
                      </td>
                    );
                  })}
                  <td className="text-center font-semibold text-gray-700 py-1">
                    {IMPACTS.reduce((s, i) => s + (matrix[disc]?.[i] ?? 0), 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {loading && (
        <div className="mt-4 text-sm text-gray-400">Loading constraints…</div>
      )}
    </div>
  );
}
