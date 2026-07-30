'use client';

/**
 * M7.6G — Platform Analytics Page
 */

import useSWR from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
};

export default function AnalyticsPage() {
  const { data, error } = useSWR('/api/admin/analytics', fetcher, { refreshInterval: 60000 });

  if (error) return <div className="p-8 text-red-500">Failed to load analytics.</div>;
  if (!data) return <div className="p-8 text-gray-500 animate-pulse">Computing analytics...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Auto-refresh: 60s</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon="📊" label="DAU" value={data.dau} />
        <MetricCard icon="📈" label="MAU" value={data.mau} />
        <MetricCard icon="🏢" label="Organizations" value={data.totalOrgs} />
        <MetricCard icon="👥" label="Users" value={data.totalUsers} />
      </div>

      {/* Notification Stats */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">📬 Notification Performance</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Total" value={data.notificationStats.total} />
          <MetricCard label="Read" value={data.notificationStats.read} color="#10b981" />
          <MetricCard label="Unread" value={data.notificationStats.unread} color="#f59e0b" />
          <MetricCard label="Read Rate" value={`${data.notificationStats.readRate}%`} color="#3b82f6" />
        </div>
      </div>

      {/* AI Usage */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">🤖 AI Extraction Jobs</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(data.aiUsage).map(([status, count]) => (
            <div key={status} className="bg-gray-50 rounded-lg p-3">
              <span className="text-xs text-gray-400 block capitalize">{status.replace(/_/g, ' ')}</span>
              <span className="text-lg font-bold text-gray-900">{count as number}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Adoption */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">🚩 Feature Adoption</h2>
        <div className="space-y-2">
          {data.featureAdoption.map((f: any) => (
            <div key={f.key} className="flex items-center justify-between py-2 border-b border-gray-50">
              <div>
                <span className="text-sm font-medium text-gray-900">{f.key}</span>
                {f.description && (
                  <span className="text-xs text-gray-400 ml-2">{f.description}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full ${f.globalEnabled ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                  {f.globalEnabled ? 'Global ON' : 'Global OFF'}
                </span>
                <span className="text-xs text-gray-500">{f.orgAdoption} orgs</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Org Growth */}
      {data.orgGrowth.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">📈 Organization Growth (90 days)</h2>
          <div className="flex items-end gap-1 h-32">
            {data.orgGrowth.map((w: any, i: number) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-indigo-500 rounded-t"
                  style={{ height: `${Math.max(4, (w.count / Math.max(...data.orgGrowth.map((g: any) => g.count))) * 100)}%` }}
                />
                <span className="text-[9px] text-gray-400">{w.week.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inactive Orgs */}
      {data.inactiveOrgs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            ⚠️ Inactive Organizations ({data.inactiveOrgs.length})
          </h2>
          <div className="space-y-2">
            {data.inactiveOrgs.slice(0, 10).map((org: any) => (
              <div key={org.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-900">{org.name}</span>
                <span className="text-xs text-gray-400">
                  {org.lastLogin ? `Last login: ${new Date(org.lastLogin).toLocaleDateString()}` : 'Never logged in'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon?: string; label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon && <span className="text-lg">{icon}</span>}
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <span className="text-2xl font-bold" style={{ color: color ?? '#1f2937' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
    </div>
  );
}
