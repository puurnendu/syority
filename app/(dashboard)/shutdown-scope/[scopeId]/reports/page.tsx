'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';

type ReportTab = 'register' | 'deferred' | 'changes' | 'summary';

export default function ScopeReportsPage() {
  const { scopeId } = useParams() as { scopeId: string };
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as ReportTab) || 'register';
  const [tab, setTab] = useState<ReportTab>(initialTab);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const endpoints: Record<ReportTab, string> = {
      register: `/api/shutdown-scope/scopes/${scopeId}/reports/register`,
      deferred: `/api/shutdown-scope/scopes/${scopeId}/reports/deferred`,
      changes: `/api/shutdown-scope/scopes/${scopeId}/reports/changes`,
      summary: `/api/shutdown-scope/scopes/${scopeId}/reports/department-summary`,
    };
    const res = await fetch(endpoints[tab]);
    setData(await res.json());
    setLoading(false);
  }, [tab, scopeId]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/shutdown-scope/${scopeId}`} className="text-xs text-blue-600 hover:underline">← Back to Scope</Link>
        <h1 className="text-xl font-bold text-gray-900 mt-1">📊 Scope Reports</h1>
      </div>

      <div className="flex gap-2">
        {([
          ['register', 'Scope Register'],
          ['deferred', 'Deferred Register'],
          ['changes', 'Change Log'],
          ['summary', 'Department Summary'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 text-sm rounded-lg ${tab === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading report...</div>
      ) : (
        <div className="bg-white border rounded-xl p-4 overflow-x-auto">
          {tab === 'register' && data?.data && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Asset Tag</th>
                  <th className="px-3 py-2 text-left">Asset Name</th>
                  <th className="px-3 py-2 text-left">Reason</th>
                  <th className="px-3 py-2">Discipline</th>
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-3 py-2">Hours</th>
                  <th className="px-3 py-2">Issues</th>
                  <th className="px-3 py-2">Package</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.data.map((item: any) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 font-mono text-xs">{item.asset?.tag_number}</td>
                    <td className="px-3 py-2">{item.asset?.name}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-xs truncate">{item.reason}</td>
                    <td className="px-3 py-2 text-center">{item.discipline || '—'}</td>
                    <td className="px-3 py-2 text-center">{item.priority}</td>
                    <td className="px-3 py-2 text-center">{item.estimated_hours}</td>
                    <td className="px-3 py-2 text-center">{item._count?.issue_links || 0}</td>
                    <td className="px-3 py-2 text-center text-xs">{item.package?.name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'deferred' && data?.data && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Asset</th>
                  <th className="px-3 py-2 text-left">Reason for Deferral</th>
                  <th className="px-3 py-2">Target TA</th>
                  <th className="px-3 py-2">Carried Forward</th>
                  <th className="px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.data.map((d: any) => (
                  <tr key={d.id}>
                    <td className="px-3 py-2 font-medium">{d.scope_item?.asset?.tag_number}</td>
                    <td className="px-3 py-2 text-gray-600">{d.reason}</td>
                    <td className="px-3 py-2 text-center">{d.target_event || '—'}</td>
                    <td className="px-3 py-2 text-center">{d.carried_forward ? '✅' : '—'}</td>
                    <td className="px-3 py-2 text-center text-xs">{new Date(d.deferred_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'changes' && data?.data && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-left">Reason</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Hours</th>
                  <th className="px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.data.map((cr: any) => (
                  <tr key={cr.id}>
                    <td className="px-3 py-2 uppercase text-xs font-medium">{cr.change_type}</td>
                    <td className="px-3 py-2">{cr.title}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-xs truncate">{cr.reason}</td>
                    <td className="px-3 py-2 text-center">{cr.status}</td>
                    <td className="px-3 py-2 text-center">{cr.estimated_hours || '—'}</td>
                    <td className="px-3 py-2 text-center text-xs">{new Date(cr.submitted_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'summary' && data && (
            <div className="grid grid-cols-3 gap-6">
              <div>
                <h3 className="font-semibold text-sm mb-2">By Discipline</h3>
                {data.by_discipline?.map((d: any) => (
                  <div key={d.discipline} className="flex justify-between text-sm py-1 border-b">
                    <span>{d.discipline}</span>
                    <span>{d.count} items — {d.estimated_hours} hrs</span>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-2">By Department</h3>
                {data.by_department?.map((d: any) => (
                  <div key={d.department} className="flex justify-between text-sm py-1 border-b">
                    <span>{d.department}</span>
                    <span>{d.count} items — {d.estimated_hours} hrs</span>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-2">By Priority</h3>
                {data.by_priority?.map((p: any) => (
                  <div key={p.priority} className="flex justify-between text-sm py-1 border-b">
                    <span>{p.priority}</span>
                    <span>{p.count} items — {p.estimated_hours} hrs</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
