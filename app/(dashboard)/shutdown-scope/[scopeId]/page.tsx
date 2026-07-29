'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

const TABS = ['Overview', 'Scope Items', 'Builder', 'Changes', 'Deferrals', 'Packages', 'Reports'] as const;
type Tab = (typeof TABS)[number];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  frozen: 'bg-indigo-100 text-indigo-700',
  closed: 'bg-green-100 text-green-700',
};

export default function ScopeDetailPage() {
  const { scopeId } = useParams() as { scopeId: string };
  const router = useRouter();
  const [scope, setScope] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [changes, setChanges] = useState<any[]>([]);
  const [deferrals, setDeferrals] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>('Overview');
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');

  const fetchScope = useCallback(async () => {
    const res = await fetch(`/api/shutdown-scope/scopes/${scopeId}`);
    if (!res.ok) return;
    setScope(await res.json());
    setLoading(false);
  }, [scopeId]);

  const fetchItems = useCallback(async () => {
    const res = await fetch(`/api/shutdown-scope/scopes/${scopeId}/items`);
    const data = await res.json();
    setItems(data.data || []);
  }, [scopeId]);

  const fetchChanges = useCallback(async () => {
    const res = await fetch(`/api/shutdown-scope/scopes/${scopeId}/changes`);
    const data = await res.json();
    setChanges(data.data || []);
  }, [scopeId]);

  const fetchDeferrals = useCallback(async () => {
    const res = await fetch(`/api/shutdown-scope/scopes/${scopeId}/deferrals`);
    const data = await res.json();
    setDeferrals(data.data || []);
  }, [scopeId]);

  const fetchPackages = useCallback(async () => {
    const res = await fetch(`/api/shutdown-scope/scopes/${scopeId}/packages`);
    const data = await res.json();
    setPackages(data.data || []);
  }, [scopeId]);

  useEffect(() => { fetchScope(); }, [fetchScope]);
  useEffect(() => { if (tab === 'Scope Items') fetchItems(); }, [tab, fetchItems]);
  useEffect(() => { if (tab === 'Changes') fetchChanges(); }, [tab, fetchChanges]);
  useEffect(() => { if (tab === 'Deferrals') fetchDeferrals(); }, [tab, fetchDeferrals]);
  useEffect(() => { if (tab === 'Packages') fetchPackages(); }, [tab, fetchPackages]);

  const changeStatus = async (newStatus: string) => {
    if (!confirm(`Change scope status to ${newStatus.toUpperCase()}?`)) return;
    const res = await fetch(`/api/shutdown-scope/scopes/${scopeId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setStatusMsg(`Status changed to ${newStatus}`);
      fetchScope();
    } else {
      const err = await res.json();
      setStatusMsg(`Error: ${err.error}`);
    }
    setTimeout(() => setStatusMsg(''), 4000);
  };

  const removeItem = async (itemId: string) => {
    if (!confirm('Remove this item from scope?')) return;
    await fetch(`/api/shutdown-scope/scopes/${scopeId}/items/${itemId}`, { method: 'DELETE' });
    fetchItems();
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Loading scope...</div>;
  if (!scope) return <div className="text-center py-12 text-red-500">Scope not found</div>;

  const stats = scope.live_stats;
  const isFrozen = scope.status === 'frozen' || scope.status === 'closed';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/shutdown-scope" className="text-xs text-blue-600 hover:underline">← Back to Scopes</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{scope.name}</h1>
          <p className="text-sm text-gray-500">
            Event: {scope.event.name} ({scope.event.code})
            {scope.freeze_date && <> | Freeze: {new Date(scope.freeze_date).toLocaleDateString()}</>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${STATUS_COLORS[scope.status]}`}>
            {scope.status.toUpperCase()}
          </span>
          {scope.status === 'draft' && <button onClick={() => changeStatus('review')} className="px-3 py-1.5 text-xs bg-yellow-500 text-white rounded-lg hover:bg-yellow-600">Submit for Review</button>}
          {scope.status === 'review' && <button onClick={() => changeStatus('approved')} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Approve</button>}
          {scope.status === 'review' && <button onClick={() => changeStatus('draft')} className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Return to Draft</button>}
          {scope.status === 'approved' && <button onClick={() => changeStatus('frozen')} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">🔒 Freeze Scope</button>}
          {scope.status === 'frozen' && <button onClick={() => changeStatus('closed')} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">Close Scope</button>}
        </div>
      </div>

      {statusMsg && <div className="p-2 text-sm bg-blue-50 border border-blue-200 rounded-lg text-blue-700">{statusMsg}</div>}

      {/* Stats Row */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: 'Scope Items', value: stats?.total_items || 0, color: 'blue' },
          { label: 'Estimated Hours', value: (stats?.total_estimated_hrs || 0).toLocaleString(), color: 'green' },
          { label: 'Deferred', value: stats?.deferred || 0, color: 'amber' },
          { label: 'Late Additions', value: stats?.additional || 0, color: 'orange' },
          { label: 'Packages', value: stats?.packages || 0, color: 'purple' },
          { label: 'Pending CRs', value: stats?.change_requests?.pending || 0, color: 'red' },
        ].map((s) => (
          <div key={s.label} className="p-3 bg-white border rounded-lg text-center">
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-0.5 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'Overview' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white p-5 border rounded-xl space-y-3">
            <h3 className="font-semibold text-gray-900">Scope Details</h3>
            {scope.objectives && <div><span className="text-xs text-gray-500">Objectives</span><p className="text-sm">{scope.objectives}</p></div>}
            {scope.description && <div><span className="text-xs text-gray-500">Description</span><p className="text-sm">{scope.description}</p></div>}
            {scope.budget_manhours && <div><span className="text-xs text-gray-500">Budget Manhours</span><p className="text-sm font-medium">{scope.budget_manhours.toLocaleString()}</p></div>}
            {scope.budget_cost && <div><span className="text-xs text-gray-500">Budget Cost</span><p className="text-sm font-medium">${parseFloat(scope.budget_cost).toLocaleString()}</p></div>}
          </div>
          <div className="bg-white p-5 border rounded-xl space-y-3">
            <h3 className="font-semibold text-gray-900">By Discipline</h3>
            {stats?.by_discipline?.map((d: any) => (
              <div key={d.discipline} className="flex justify-between text-sm">
                <span>{d.discipline}</span>
                <span className="font-medium">{d.count} items</span>
              </div>
            ))}
            {(!stats?.by_discipline || stats.by_discipline.length === 0) && <p className="text-sm text-gray-400">No items yet</p>}
          </div>
        </div>
      )}

      {tab === 'Scope Items' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">{items.length} items</span>
            {!isFrozen && (
              <Link
                href={`/shutdown-scope/${scopeId}/builder`}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Open Scope Builder
              </Link>
            )}
          </div>
          <div className="overflow-x-auto bg-white border rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Asset</th>
                  <th className="px-3 py-2 text-left">Reason</th>
                  <th className="px-3 py-2 text-left">Discipline</th>
                  <th className="px-3 py-2 text-center">Priority</th>
                  <th className="px-3 py-2 text-center">Hours</th>
                  <th className="px-3 py-2 text-center">Issues</th>
                  <th className="px-3 py-2 text-center">Package</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  {!isFrozen && <th className="px-3 py-2"></th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {item.asset?.tag_number}
                      <div className="text-xs text-gray-400">{item.asset?.name}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-600 max-w-xs truncate">{item.reason}</td>
                    <td className="px-3 py-2">{item.discipline || '—'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        item.priority === 'critical' ? 'bg-red-100 text-red-700' :
                        item.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                        item.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{item.priority}</span>
                    </td>
                    <td className="px-3 py-2 text-center font-medium">{item.estimated_hours}</td>
                    <td className="px-3 py-2 text-center">{item._count?.issue_links || 0}</td>
                    <td className="px-3 py-2 text-center text-xs">{item.package?.name || '—'}</td>
                    <td className="px-3 py-2 text-center">
                      {item.is_deferred && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Deferred</span>}
                      {item.is_additional && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">{item.additional_type || 'Added'}</span>}
                    </td>
                    {!isFrozen && (
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => removeItem(item.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'Builder' && (
        <div className="text-center py-8">
          <Link
            href={`/shutdown-scope/${scopeId}/builder`}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 inline-flex items-center gap-2"
          >
            🏗️ Open Full-Screen Builder
          </Link>
          <p className="text-sm text-gray-500 mt-2">
            Interactive hierarchy tree with asset selection and AI recommendations
          </p>
        </div>
      )}

      {tab === 'Changes' && (
        <div className="space-y-4">
          {isFrozen && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700 text-sm">
              🔒 Scope is frozen. All modifications require a Change Request.
            </div>
          )}
          {changes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No change requests</p>
          ) : (
            <div className="space-y-3">
              {changes.map((cr) => (
                <div key={cr.id} className="p-4 bg-white border rounded-lg">
                  <div className="flex justify-between">
                    <div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded mr-2 ${
                        cr.change_type === 'added' || cr.change_type === 'emergency' ? 'bg-green-100 text-green-700' :
                        cr.change_type === 'removed' || cr.change_type === 'cancelled' ? 'bg-red-100 text-red-700' :
                        cr.change_type === 'deferred' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>{cr.change_type}</span>
                      <strong className="text-sm">{cr.title}</strong>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      cr.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      cr.status === 'approved' ? 'bg-green-100 text-green-700' :
                      'bg-red-100 text-red-700'
                    }`}>{cr.status}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{cr.reason}</p>
                  {cr.estimated_hours && <p className="text-xs text-gray-400 mt-1">Est. {cr.estimated_hours} hrs</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'Deferrals' && (
        <div className="space-y-4">
          {deferrals.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No deferred items</p>
          ) : (
            <div className="overflow-x-auto bg-white border rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Asset</th>
                    <th className="px-3 py-2 text-left">Reason</th>
                    <th className="px-3 py-2 text-left">Target TA</th>
                    <th className="px-3 py-2 text-center">Carried Forward</th>
                    <th className="px-3 py-2 text-left">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {deferrals.map((d: any) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{d.scope_item?.asset?.tag_number}</td>
                      <td className="px-3 py-2 text-gray-600">{d.reason}</td>
                      <td className="px-3 py-2">{d.target_event || '—'}</td>
                      <td className="px-3 py-2 text-center">{d.carried_forward ? '✅' : '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{new Date(d.deferred_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'Packages' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={async () => {
                const res = await fetch(`/api/shutdown-scope/scopes/${scopeId}/packages`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: 'auto', auto_generate: 'discipline' }),
                });
                if (res.ok) fetchPackages();
              }}
              className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Auto-Generate by Discipline
            </button>
          </div>
          {packages.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No packages created</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {packages.map((pkg: any) => (
                <div key={pkg.id} className="p-4 bg-white border rounded-xl">
                  <h3 className="font-semibold text-gray-900">{pkg.name}</h3>
                  <div className="flex gap-4 mt-2 text-sm text-gray-600">
                    <span>{pkg._count?.items || 0} items</span>
                    <span>{(pkg.items?.reduce((s: number, i: any) => s + (i.estimated_hours || 0), 0) || 0).toLocaleString()} hrs</span>
                    {pkg.discipline && <span>{pkg.discipline}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'Reports' && (
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Scope Register', desc: 'Complete list of all scope items', href: `/shutdown-scope/${scopeId}/reports` },
            { label: 'Deferred Register', desc: 'All deferred items with reasons', href: `/shutdown-scope/${scopeId}/reports?tab=deferred` },
            { label: 'Change Log', desc: 'Post-freeze change requests', href: `/shutdown-scope/${scopeId}/reports?tab=changes` },
            { label: 'Department Summary', desc: 'Breakdown by discipline and priority', href: `/shutdown-scope/${scopeId}/reports?tab=summary` },
          ].map((r) => (
            <Link key={r.label} href={r.href} className="p-4 bg-white border rounded-xl hover:shadow-md transition-shadow">
              <h3 className="font-semibold text-gray-900">{r.label}</h3>
              <p className="text-sm text-gray-500 mt-1">{r.desc}</p>
            </Link>
          ))}
          <Link href="/shutdown-scope/compare" className="p-4 bg-white border rounded-xl hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-gray-900">TA Comparison</h3>
            <p className="text-sm text-gray-500 mt-1">Compare scope between two shutdowns</p>
          </Link>
        </div>
      )}
    </div>
  );
}
