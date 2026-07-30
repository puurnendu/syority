'use client';

/**
 * M7.6G — Module Management Page
 *
 * Platform admin page for managing per-organization module enablement.
 */

import { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  enabled: { label: 'Enabled', color: '#10b981', bg: '#dcfce7' },
  disabled: { label: 'Disabled', color: '#6b7280', bg: '#f3f4f6' },
  hidden: { label: 'Hidden', color: '#9ca3af', bg: '#f9fafb' },
  beta: { label: 'Beta', color: '#8b5cf6', bg: '#f3e8ff' },
  coming_soon: { label: 'Coming Soon', color: '#f59e0b', bg: '#fef3c7' },
  experimental: { label: 'Experimental', color: '#ef4444', bg: '#fef2f2' },
};

const CATEGORY_ORDER = ['core', 'planning', 'intelligence', 'safety', 'future'];

export default function ModulesPage() {
  const { data: orgsData } = useSWR('/api/admin/tenants', fetcher);
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const orgs = Array.isArray(orgsData) ? orgsData : (orgsData?.tenants ?? []);

  // Seed modules on first load
  useEffect(() => {
    fetch('/api/admin/modules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'seed' }),
    }).catch(() => {});
  }, []);

  const { data: modulesData, mutate } = useSWR(
    selectedOrg ? `/api/admin/modules?organizationId=${selectedOrg}` : null,
    fetcher,
  );

  const { data: catalogData } = useSWR('/api/admin/modules', fetcher);
  const catalog = catalogData?.catalog ?? [];
  const modules = modulesData?.modules ?? [];

  const handleStatusChange = async (moduleId: string, newStatus: string) => {
    setLoading(moduleId);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/modules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: selectedOrg, moduleId, status: newStatus }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      mutate();
      setMsg('Module status updated');
    } catch (err: any) {
      setMsg(`Error: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = modules.filter((m: any) => m.category === cat);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Module Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          {catalog.length} modules in catalog · Enable or disable per organization
        </p>
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
          msg.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
        }`}>
          {msg}
        </div>
      )}

      {/* Organization Selector */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <label className="block text-xs font-medium text-gray-500 mb-2">Select Organization</label>
        <select
          value={selectedOrg}
          onChange={(e) => setSelectedOrg(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-gray-200 rounded-lg text-sm"
        >
          <option value="">— Select an organization —</option>
          {orgs.map((org: any) => (
            <option key={org.id} value={org.id}>{org.name}</option>
          ))}
        </select>
      </div>

      {/* Module Grid */}
      {selectedOrg && modules.length > 0 && (
        <div className="space-y-8">
          {CATEGORY_ORDER.filter((cat) => grouped[cat]?.length > 0).map((cat) => (
            <div key={cat}>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {cat}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {grouped[cat].map((mod: any) => {
                  const statusConf = STATUS_CONFIG[mod.status] ?? STATUS_CONFIG.disabled;
                  return (
                    <div
                      key={mod.id}
                      className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{mod.icon}</span>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900">{mod.name}</h3>
                            <span className="text-xs text-gray-400">{mod.slug}</span>
                          </div>
                        </div>
                        <span
                          className="px-2 py-0.5 text-xs font-medium rounded-full"
                          style={{ backgroundColor: statusConf.bg, color: statusConf.color }}
                        >
                          {statusConf.label}
                        </span>
                      </div>

                      {mod.description && (
                        <p className="text-xs text-gray-500 mt-2">{mod.description}</p>
                      )}

                      {!mod.isCore && (
                        <div className="mt-3">
                          <select
                            value={mod.status}
                            onChange={(e) => handleStatusChange(mod.id, e.target.value)}
                            disabled={loading === mod.id}
                            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg"
                          >
                            {Object.entries(STATUS_CONFIG).map(([key, conf]) => (
                              <option key={key} value={key}>{conf.label}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {mod.isCore && (
                        <div className="mt-3 text-xs text-gray-400 italic">
                          Core module — cannot be disabled
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedOrg && modules.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          No modules configured for this organization.
          <button
            onClick={async () => {
              await fetch('/api/admin/modules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'initialize', organizationId: selectedOrg }),
              });
              mutate();
            }}
            className="block mx-auto mt-3 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
          >
            Initialize Modules
          </button>
        </div>
      )}
    </div>
  );
}
