'use client';

/**
 * M7.6G.1 — Platform Backup Manager
 *
 * Create, verify, restore, delete backups.
 */

import { useState, useCallback } from 'react';
import useSWR, { mutate } from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
};

const BACKUP_TYPES = ['full', 'config_only', 'data_only', 'documents_only'];
const STATUS_ICONS: Record<string, string> = {
  completed: '✅', running: '⏳', failed: '❌', pending: '🕐', expired: '⏰',
};

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function BackupsPage() {
  const { data, error } = useSWR('/api/admin/backups', fetcher, { refreshInterval: 15000 });
  const [creating, setCreating] = useState(false);
  const [backupType, setBackupType] = useState<string>('full');
  const [backupName, setBackupName] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const createBackup = useCallback(async () => {
    setCreating(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          type: backupType,
          name: backupName || undefined,
          retentionDays: 90,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage({ type: 'success', text: `Backup created: ${formatBytes(data.size)} — ${data.checksum.slice(0, 12)}…` });
      setBackupName('');
      mutate('/api/admin/backups');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setCreating(false);
    }
  }, [backupType, backupName]);

  const verifyBackup = useCallback(async (id: string) => {
    const res = await fetch('/api/admin/backups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', backupId: id }),
    });
    const data = await res.json();
    setMessage({ type: data.valid ? 'success' : 'error', text: data.message });
  }, []);

  const deleteBackup = useCallback(async (id: string) => {
    if (!confirm('Delete this backup permanently?')) return;
    await fetch(`/api/admin/backups/${id}`, { method: 'DELETE' });
    mutate('/api/admin/backups');
  }, []);

  const restoreBackup = useCallback(async (id: string) => {
    if (!confirm('This will restore configuration from this backup. Continue?')) return;
    setMessage(null);
    try {
      const res = await fetch('/api/admin/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', backupId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage({ type: 'success', text: `Restored ${data.recordsRestored} records` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  }, []);

  const stats = data?.stats;
  const backups = data?.items ?? [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Backups</h1>
        <p className="text-sm text-gray-500 mt-1">Create, verify, and restore platform backups</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon="💾" label="Total Backups" value={stats.total} />
          <StatCard icon="📦" label="Total Size" value={formatBytes(stats.totalSizeBytes)} />
          <StatCard icon="🔄" label="Restores" value={stats.restoreCount} />
          <StatCard icon="🕐" label="Last Backup" value={stats.lastBackup ? new Date(stats.lastBackup).toLocaleDateString() : 'Never'} />
        </div>
      )}

      {/* Create */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Create Backup</h2>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Name (optional)</label>
            <input
              value={backupName}
              onChange={(e) => setBackupName(e.target.value)}
              placeholder="Auto-generated if empty"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Type</label>
            <select
              value={backupType}
              onChange={(e) => setBackupType(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              {BACKUP_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <button
            onClick={createBackup}
            disabled={creating}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {creating ? 'Creating...' : '💾 Create Backup'}
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`rounded-lg p-3 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Backup List */}
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-5 py-3 border-b border-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Backup History</h2>
        </div>
        {backups.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No backups yet.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {backups.map((b: any) => (
              <div key={b.id} className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-lg">{STATUS_ICONS[b.status] ?? '❓'}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{b.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-400 capitalize">{b.type.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-gray-400">{formatBytes(Number(b.file_size_bytes ?? 0))}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(b.started_at).toLocaleString()}
                      </span>
                    </div>
                    {b.checksum && (
                      <span className="text-xs text-gray-300 font-mono">{b.checksum.slice(0, 16)}…</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {b.status === 'completed' && (
                    <>
                      <button
                        onClick={() => verifyBackup(b.id)}
                        className="px-3 py-1 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
                      >
                        Verify
                      </button>
                      <button
                        onClick={() => restoreBackup(b.id)}
                        className="px-3 py-1 border border-blue-200 text-blue-600 text-xs rounded-lg hover:bg-blue-50"
                      >
                        Restore
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => deleteBackup(b.id)}
                    className="px-3 py-1 border border-red-200 text-red-500 text-xs rounded-lg hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-1">
        <span>{icon}</span>
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <span className="text-xl font-bold text-gray-900">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
    </div>
  );
}
