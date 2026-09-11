'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { NotificationSubNav } from '@/components/platform/NotificationSubNav';

interface QueueItem {
  id: string;
  channel: string;
  recipient_email: string | null;
  recipient_name: string | null;
  subject: string;
  status: string;
  priority: number;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  event_type: string | null;
  scheduled_for: string | null;
  sent_at: string | null;
  created_at: string;
  template: { name: string; slug: string } | null;
  provider: { name: string } | null;
}

interface QueueStats {
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  retrying: number;
  cancelled: number;
  total: number;
}



const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  sending: 'bg-blue-100 text-blue-700',
  sent: 'bg-green-100 text-green-700',
  delivered: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  retrying: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function QueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const fetchQueue = useCallback(async () => {
    try {
      const url = filter
        ? `/api/platform/notifications/queue?status=${filter}`
        : '/api/platform/notifications/queue';
      const res = await fetch(url);
      if (res.ok) {
        const d = await res.json();
        setItems(d.items || []);
        setStats(d.stats || null);
        setTotal(d.total || 0);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  async function processNow() {
    setProcessing(true);
    try {
      await fetch('/api/platform/notifications/queue', { method: 'POST' });
      await fetchQueue();
    } catch { /* ignore */ } finally { setProcessing(false); }
  }

  async function cancelItem(id: string) {
    await fetch(`/api/platform/notifications/queue/${id}/cancel`, { method: 'POST' });
    await fetchQueue();
  }

  async function retryItem(id: string) {
    await fetch(`/api/platform/notifications/queue/${id}/retry`, { method: 'POST' });
    await fetchQueue();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Notification Queue</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor and manage pending notifications</p>
        </div>
        <button onClick={processNow} disabled={processing}
          className="px-4 py-2 bg-[#0D2137] text-white text-sm font-medium rounded-lg hover:bg-[#1a3a5c] disabled:opacity-50">
          {processing ? 'Processing…' : '⚡ Process Now'}
        </button>
      </div>

      <NotificationSubNav />

      {/* Stats Row */}
      {stats && (
        <div className="flex gap-2 flex-wrap">
          {(['pending', 'sending', 'sent', 'failed', 'retrying', 'cancelled'] as const).map((s) => (
            <button key={s} onClick={() => setFilter(filter === s ? null : s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === s ? 'bg-[#0D2137] text-white' : `${STATUS_COLORS[s]} hover:opacity-80`
              }`}>
              {s}: {stats[s]}
            </button>
          ))}
          <span className="px-3 py-1.5 text-xs text-gray-500">Total: {stats.total}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading queue…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-3">📭</div>
          <h3 className="text-lg font-semibold text-gray-700">Queue Empty</h3>
          <p className="text-sm text-gray-500 mt-1">{filter ? `No "${filter}" items found.` : 'No notifications in queue.'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Recipient</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Subject</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Template</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Attempts</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Created</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="text-gray-900">{item.recipient_email}</div>
                    {item.recipient_name && <div className="text-xs text-gray-400">{item.recipient_name}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{item.subject}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {item.status}
                    </span>
                    {item.last_error && <div className="text-xs text-red-500 mt-1 max-w-[150px] truncate" title={item.last_error}>{item.last_error}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{item.template?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{item.attempts}/{item.max_attempts}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(item.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    {(item.status === 'pending' || item.status === 'retrying') && (
                      <button onClick={() => cancelItem(item.id)} className="text-xs text-red-600 hover:underline mr-2">Cancel</button>
                    )}
                    {(item.status === 'failed' || item.status === 'cancelled') && (
                      <button onClick={() => retryItem(item.id)} className="text-xs text-blue-600 hover:underline">Retry</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > items.length && (
            <div className="p-3 text-center text-xs text-gray-400">Showing {items.length} of {total} items</div>
          )}
        </div>
      )}
    </div>
  );
}
