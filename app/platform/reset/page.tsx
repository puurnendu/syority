'use client';

/**
 * M7.6G.1 — Organization Data Reset
 *
 * Select org, choose categories to reset, preview, confirm, execute.
 */

import { useState, useCallback } from 'react';
import useSWR from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
};

const RESET_CATEGORIES = [
  { key: 'planning', label: 'Shutdown Events', icon: '📅', default: true },
  { key: 'issues', label: 'Engineering Issues', icon: '🔧', default: true },
  { key: 'workpacks', label: 'Workpacks & Activities', icon: '📋', default: true },
  { key: 'notifications', label: 'Notifications', icon: '🔔', default: true },
  { key: 'feedback', label: 'Feedback', icon: '💬', default: true },
  { key: 'usage', label: 'Usage Statistics', icon: '📊', default: true },
];

const KEEP_OPTIONS = [
  { key: 'keepUsers', label: 'Users', icon: '👥', default: true },
  { key: 'keepRoles', label: 'Roles', icon: '🔐', default: true },
  { key: 'keepBranding', label: 'Branding', icon: '🎨', default: true },
  { key: 'keepLicense', label: 'License', icon: '📜', default: true },
  { key: 'keepFeatureFlags', label: 'Feature Flags', icon: '🚩', default: true },
  { key: 'keepModules', label: 'Modules', icon: '🧩', default: true },
];

export default function ResetPage() {
  const { data: orgData } = useSWR('/api/admin/tenants', fetcher);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [resetCategories, setResetCategories] = useState<Record<string, boolean>>(
    Object.fromEntries(RESET_CATEGORIES.map((c) => [c.key, c.default]))
  );
  const [keepOptions, setKeepOptions] = useState<Record<string, boolean>>(
    Object.fromEntries(KEEP_OPTIONS.map((o) => [o.key, o.default]))
  );
  const [preview, setPreview] = useState<any>(null);
  const [confirmText, setConfirmText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const orgs = (orgData?.tenants ?? orgData?.organizations ?? []).filter(
    (o: any) => o.slug !== 'syority-platform'
  );

  const runPreview = useCallback(async () => {
    if (!selectedOrg) return;
    setLoading(true);
    const options = { ...resetCategories, ...keepOptions };
    const res = await fetch('/api/admin/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'preview', organizationId: selectedOrg, options }),
    });
    const data = await res.json();
    setPreview(data);
    setLoading(false);
  }, [selectedOrg, resetCategories, keepOptions]);

  const executeReset = useCallback(async () => {
    if (!selectedOrg) return;
    setLoading(true);
    setResult(null);
    const options = { ...resetCategories, ...keepOptions };
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'execute', organizationId: selectedOrg, options }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      setPreview(null);
      setConfirmText('');
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  }, [selectedOrg, resetCategories, keepOptions]);

  const selectedOrgName = orgs.find((o: any) => o.id === selectedOrg)?.name ?? '';

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Organization Data Reset</h1>
        <p className="text-sm text-gray-500 mt-1">
          Reset beta organization data without deleting the tenant
        </p>
      </div>

      {/* Warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm text-amber-800 font-medium">⚠️ Data reset is destructive</p>
        <p className="text-xs text-amber-600 mt-1">A rollback backup will be created automatically before reset.</p>
      </div>

      {/* Organization Selector */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Organization</label>
        <select
          value={selectedOrg}
          onChange={(e) => { setSelectedOrg(e.target.value); setPreview(null); setResult(null); }}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
        >
          <option value="">— Select —</option>
          {orgs.map((o: any) => (
            <option key={o.id} value={o.id}>{o.name} ({o.slug})</option>
          ))}
        </select>
      </div>

      {selectedOrg && (
        <>
          {/* Categories to Reset */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Categories to Reset</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {RESET_CATEGORIES.map((cat) => (
                <label
                  key={cat.key}
                  className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition ${
                    resetCategories[cat.key] ? 'border-red-200 bg-red-50' : 'border-gray-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={resetCategories[cat.key]}
                    onChange={(e) => setResetCategories({ ...resetCategories, [cat.key]: e.target.checked })}
                    className="rounded text-red-500"
                  />
                  <span>{cat.icon}</span>
                  <span className="text-sm text-gray-700">{cat.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* What to Keep */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Preserved (Keep)</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {KEEP_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition ${
                    keepOptions[opt.key] ? 'border-green-200 bg-green-50' : 'border-gray-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={keepOptions[opt.key]}
                    onChange={(e) => setKeepOptions({ ...keepOptions, [opt.key]: e.target.checked })}
                    className="rounded text-green-500"
                  />
                  <span>{opt.icon}</span>
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Preview */}
          <button
            onClick={runPreview}
            disabled={loading}
            className="w-full px-4 py-2.5 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-900 disabled:opacity-50 transition"
          >
            {loading ? 'Computing...' : '🔍 Preview Affected Records'}
          </button>

          {preview && !preview.error && (
            <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">
                Preview: {preview.organizationName}
              </h3>
              <div className="space-y-2">
                {preview.categories.map((cat: any) => (
                  <div key={cat.category} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                    <span className="text-sm text-gray-700">{cat.category}</span>
                    <span className="text-sm font-medium text-red-600">{cat.recordCount} records</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <span className="text-sm font-semibold text-gray-900">Total</span>
                <span className="text-lg font-bold text-red-600">{preview.totalRecords} records</span>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs text-green-600 font-medium mb-1">Will be preserved:</p>
                <p className="text-xs text-green-700">{preview.preserved.join(' • ')}</p>
              </div>

              {/* Confirmation */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Type <strong>{selectedOrgName}</strong> to confirm:
                </label>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder={selectedOrgName}
                />
              </div>
              <button
                onClick={executeReset}
                disabled={loading || confirmText !== selectedOrgName || preview.totalRecords === 0}
                className="w-full px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
              >
                {loading ? 'Resetting...' : `🗑️ Reset ${preview.totalRecords} Records`}
              </button>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`rounded-xl p-5 border ${result.error ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              {result.error ? (
                <p className="text-sm text-red-700">❌ {result.error}</p>
              ) : (
                <div>
                  <p className="text-sm font-medium text-green-800">✅ Reset complete: {result.totalDeleted} records deleted</p>
                  {result.rollbackBackupId && (
                    <p className="text-xs text-green-600 mt-1">Rollback backup: {result.rollbackBackupId.slice(0, 8)}…</p>
                  )}
                  {result.log?.map((line: string, i: number) => (
                    <p key={i} className="text-xs text-green-700 font-mono mt-1">{line}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
