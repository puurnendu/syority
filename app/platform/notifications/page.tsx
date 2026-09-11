'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { NotificationSubNav } from '@/components/platform/NotificationSubNav';

interface DashboardStats {
  sentToday: number;
  failedToday: number;
  pendingCount: number;
  queueLength: number;
  totalSent: number;
  totalFailed: number;
  recentErrors: Array<{
    id: string;
    recipient_email: string;
    subject: string;
    failure_reason: string;
    sent_at: string;
    event_type: string;
  }>;
  topTemplates: Array<{
    templateId: string;
    templateName: string;
    count: number;
  }>;
}



export default function NotificationDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/platform/notifications/dashboard');
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  async function processQueue() {
    setProcessing(true);
    try {
      await fetch('/api/platform/notifications/queue', { method: 'POST' });
      await fetchStats();
    } catch { /* ignore */ } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Notification Platform</h1>
          <p className="text-sm text-gray-500 mt-1">Enterprise notification management &amp; delivery</p>
        </div>
        <button
          onClick={processQueue}
          disabled={processing}
          className="px-4 py-2 bg-[#0D2137] text-white text-sm font-medium rounded-lg hover:bg-[#1a3a5c] disabled:opacity-50 transition-colors"
        >
          {processing ? 'Processing…' : '⚡ Process Queue'}
        </button>
      </div>

      {/* Sub-navigation */}
      <NotificationSubNav />

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading dashboard…</div>
      ) : stats ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Sent Today', value: stats.sentToday, icon: '✅', color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Failed Today', value: stats.failedToday, icon: '❌', color: 'text-red-600', bg: 'bg-red-50' },
              { label: 'Pending', value: stats.pendingCount, icon: '⏳', color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Queue Length', value: stats.queueLength, icon: '📬', color: 'text-blue-600', bg: 'bg-blue-50' },
            ].map((card) => (
              <div key={card.label} className={`${card.bg} rounded-xl border p-5`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{card.icon}</span>
                  <span className="text-xs font-medium text-gray-500 uppercase">{card.label}</span>
                </div>
                <div className={`text-3xl font-bold ${card.color}`}>{card.value.toLocaleString()}</div>
              </div>
            ))}
          </div>

          {/* Summary Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-xs font-medium text-gray-500 uppercase mb-1">Total Sent (All Time)</div>
              <div className="text-2xl font-bold text-gray-900">{stats.totalSent.toLocaleString()}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-xs font-medium text-gray-500 uppercase mb-1">Total Failed (All Time)</div>
              <div className="text-2xl font-bold text-gray-900">{stats.totalFailed.toLocaleString()}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Templates */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">📝 Top Templates (30 days)</h3>
              {stats.topTemplates.length === 0 ? (
                <p className="text-sm text-gray-400">No template usage data yet</p>
              ) : (
                <div className="space-y-2">
                  {stats.topTemplates.map((t, i) => (
                    <div key={t.templateId ?? i} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                      <span className="text-sm text-gray-700">{t.templateName}</span>
                      <span className="text-sm font-semibold text-gray-900">{t.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Errors */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">🚨 Recent Errors</h3>
              {stats.recentErrors.length === 0 ? (
                <p className="text-sm text-gray-400">No errors — all systems healthy ✅</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {stats.recentErrors.map((e) => (
                    <div key={e.id} className="py-2 border-b border-gray-100 last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 truncate max-w-[200px]">{e.recipient_email}</span>
                        <span className="text-xs text-gray-400">{new Date(e.sent_at).toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-red-600 mt-0.5 truncate">{e.failure_reason}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-3 gap-4">
            <Link
              href="/platform/notifications/providers"
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all group"
            >
              <div className="text-2xl mb-2">🔌</div>
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">Providers</h3>
              <p className="text-xs text-gray-500 mt-1">Configure SMTP, SES, SendGrid</p>
            </Link>
            <Link
              href="/platform/notifications/templates"
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all group"
            >
              <div className="text-2xl mb-2">📝</div>
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">Templates</h3>
              <p className="text-xs text-gray-500 mt-1">Manage email templates &amp; variables</p>
            </Link>
            <Link
              href="/platform/notifications/rules"
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all group"
            >
              <div className="text-2xl mb-2">⚡</div>
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">Rules</h3>
              <p className="text-xs text-gray-500 mt-1">Configure notification rules</p>
            </Link>
          </div>
        </>
      ) : (
        <div className="text-center py-20 text-red-400">Failed to load dashboard statistics</div>
      )}
    </div>
  );
}
