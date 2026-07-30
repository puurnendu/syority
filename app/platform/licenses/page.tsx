'use client';

/**
 * M7.6G — License Management Page
 *
 * Platform admin page for managing organization licenses.
 * Shows license list, stats, create/edit capabilities.
 */

import { useState, useMemo } from 'react';
import useSWR from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
};

const TYPE_COLORS: Record<string, string> = {
  trial: '#6b7280',
  beta: '#8b5cf6',
  starter: '#3b82f6',
  professional: '#10b981',
  enterprise: '#f59e0b',
  unlimited: '#ef4444',
  custom: '#ec4899',
};

const STATUS_COLORS: Record<string, string> = {
  active: '#10b981',
  grace: '#f59e0b',
  suspended: '#ef4444',
  expired: '#6b7280',
  revoked: '#dc2626',
};

export default function LicensesPage() {
  const { data, error, mutate } = useSWR('/api/admin/licenses', fetcher);
  const [showCreate, setShowCreate] = useState(false);
  const [newOrgId, setNewOrgId] = useState('');
  const [newType, setNewType] = useState('beta');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const licenses = data?.licenses ?? [];
  const stats = data?.stats ?? {};

  const handleCreate = async () => {
    if (!newOrgId.trim()) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: newOrgId, licenseType: newType }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setMsg(`License ${d.license.license_number} created`);
      setShowCreate(false);
      setNewOrgId('');
      mutate();
    } catch (err: any) {
      setMsg(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (error) return <div className="p-8 text-red-500">Failed to load licenses.</div>;
  if (!data) return <div className="p-8 text-gray-500 animate-pulse">Loading licenses...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">License Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            {stats.total ?? 0} licenses · {stats.expiringSoon ?? 0} expiring soon
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition"
        >
          + Create License
        </button>
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
          msg.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
        }`}>
          {msg}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(stats.byType ?? {}).map(([type, count]) => (
          <div key={type} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: TYPE_COLORS[type] ?? '#6b7280' }}
              />
              <span className="text-xs font-medium text-gray-500 uppercase">{type}</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">{count as number}</span>
          </div>
        ))}
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Create New License</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Organization ID</label>
              <input
                value={newOrgId}
                onChange={(e) => setNewOrgId(e.target.value)}
                placeholder="UUID..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">License Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                {['trial', 'beta', 'starter', 'professional', 'enterprise', 'unlimited', 'custom'].map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={loading || !newOrgId.trim()}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {loading ? 'Creating...' : 'Create License'}
          </button>
        </div>
      )}

      {/* License Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">License #</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Organization</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Users</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Expires</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {licenses.map((lic: any) => (
              <tr key={lic.id} className="hover:bg-gray-50/50 transition">
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{lic.license_number}</td>
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900">{lic.organization?.name ?? '—'}</span>
                  {lic.organization?.slug && (
                    <span className="text-gray-400 ml-1 text-xs">({lic.organization.slug})</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="px-2 py-0.5 text-xs font-medium rounded-full text-white"
                    style={{ backgroundColor: TYPE_COLORS[lic.license_type] ?? '#6b7280' }}
                  >
                    {lic.license_type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="px-2 py-0.5 text-xs font-medium rounded-full"
                    style={{
                      backgroundColor: `${STATUS_COLORS[lic.status] ?? '#6b7280'}15`,
                      color: STATUS_COLORS[lic.status] ?? '#6b7280',
                    }}
                  >
                    {lic.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{lic.max_users}</td>
                <td className="px-4 py-3 text-gray-600">
                  {lic.expires_at
                    ? new Date(lic.expires_at).toLocaleDateString()
                    : '∞'}
                </td>
              </tr>
            ))}
            {licenses.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No licenses issued yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
