'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
};

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function PlatformBillingDashboard() {
  const { data: stats, error: statsError } = useSWR('/api/admin/billing/stats', fetcher);
  const { data: history, error: historyError } = useSWR('/api/admin/billing/history', fetcher);

  const tierData = useMemo(() => {
    if (!stats?.tierDistribution) return [];
    return Object.entries(stats.tierDistribution).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value: value as number
    }));
  }, [stats]);

  if (statsError || historyError) return <div className="p-8 text-red-500 font-medium">Failed to load platform financial data.</div>;
  if (!stats || !history) return <div className="p-8 text-gray-500 animate-pulse font-medium">Calculating platform metrics...</div>;
  if (typeof stats.mrr !== 'number' || !Array.isArray(history)) {
    return <div className="p-8 text-red-500 font-medium">Failed to load platform financial data.</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Platform Billing Intelligence</h1>
          <p className="text-gray-500 mt-1 font-medium">Global financial overview and subscription analytics across all tenants.</p>
        </div>
        <div className="flex items-center gap-3 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
          <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm font-bold text-blue-900">Real-time Financials</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard 
          title="Est. MRR" 
          value={`$${stats.mrr.toLocaleString()}`} 
          subtitle="Monthly Recurring Revenue"
          icon={<DollarIcon className="text-blue-600" />}
          color="blue"
        />
        <KpiCard 
          title="Total Revenue" 
          value={`$${stats.totalRevenue.toLocaleString()}`} 
          subtitle="Lifetime Platform Invoicing"
          icon={<TrendIcon className="text-emerald-600" />}
          color="emerald"
        />
        <KpiCard 
          title="Active Tenants" 
          value={stats.activeSubscriptions} 
          subtitle={`${stats.totalTenants} total managed tenants`}
          icon={<UsersIcon className="text-amber-600" />}
          color="amber"
        />
        <KpiCard 
          title="Past Due" 
          value={stats.pastDueSubscriptions} 
          subtitle="Requires attention"
          icon={<AlertIcon className="text-rose-600" />}
          color="rose"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tier Distribution Chart */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            Subscription Tiers
            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded uppercase">Counts</span>
          </h2>
          <div className="h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={tierData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {tierData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Global Recent Payments Log */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[400px]">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Recent Global Payments</h2>
            <button className="text-xs font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest">View All</button>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3">Organization</th>
                  <th className="px-6 py-3">Tier</th>
                  <th className="px-6 py-3">Reference</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {history.map((log: any) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{log.organization.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{log.organization.slug}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        log.organization.plan_tier === 'enterprise' ? 'bg-purple-100 text-purple-600' :
                        log.organization.plan_tier === 'professional' ? 'bg-blue-100 text-blue-600' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {log.organization.plan_tier || 'basic'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-600 font-medium">{log.reference || '—'}</div>
                      <div className="text-[10px] text-gray-400">{new Date(log.payment_date).toLocaleDateString('en-GB')}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-gray-900">
                      ${log.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center text-gray-400 italic">No payments recorded across the platform yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, subtitle, icon, color }: { title: string, value: any, subtitle: string, icon: any, color: string }) {
  const bgColors: any = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${bgColors[color]}`}>
          {icon}
        </div>
        <div className="text-[10px] font-black uppercase text-gray-300 tracking-widest group-hover:text-blue-500 transition-colors">Platform Info</div>
      </div>
      <div>
        <div className="text-2xl font-black text-gray-900 tracking-tight">{value}</div>
        <div className="text-sm font-bold text-gray-500 mt-1">{title}</div>
        <div className="text-[11px] text-gray-400 font-medium mt-1.5 opacity-80">{subtitle}</div>
      </div>
    </div>
  );
}

// Icons
const DollarIcon = ({ className }: { className?: string }) => (
  <svg className={`w-5 h-5 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const TrendIcon = ({ className }: { className?: string }) => (
  <svg className={`w-5 h-5 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-9 9-4-4-6 6" />
  </svg>
);

const UsersIcon = ({ className }: { className?: string }) => (
  <svg className={`w-5 h-5 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const AlertIcon = ({ className }: { className?: string }) => (
  <svg className={`w-5 h-5 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
