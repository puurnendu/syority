'use client';

/**
 * M7.6G — Beta Administration Console
 *
 * Unified view for managing beta organizations, users, feedback,
 * feature flags, licenses, and usage.
 */

import useSWR from 'swr';
import Link from 'next/link';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
};

export default function BetaAdminPage() {
  const { data: licenseData } = useSWR('/api/admin/licenses?type=beta', fetcher);
  const { data: feedbackData } = useSWR('/api/admin/feedback?status=open', fetcher);
  const { data: analyticsData } = useSWR('/api/admin/analytics', fetcher);
  const { data: diagnosticsData } = useSWR('/api/admin/diagnostics', fetcher);

  const betaLicenses = licenseData?.licenses ?? [];
  const openFeedback = feedbackData?.items ?? [];
  const feedbackStats = feedbackData?.stats ?? {};

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Beta Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Monitor beta organizations, feedback, and platform health
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <QuickStat icon="🏢" label="Beta Orgs" value={betaLicenses.length} href="/platform/licenses" />
        <QuickStat icon="📊" label="DAU" value={analyticsData?.dau ?? '—'} href="/platform/analytics" />
        <QuickStat icon="📈" label="MAU" value={analyticsData?.mau ?? '—'} href="/platform/analytics" />
        <QuickStat icon="💬" label="Open Feedback" value={feedbackStats.open ?? 0} color={feedbackStats.open > 0 ? '#f59e0b' : undefined} />
        <QuickStat
          icon={diagnosticsData?.health?.overall === 'healthy' ? '🟢' : '🟡'}
          label="Health"
          value={diagnosticsData?.health?.overall ?? 'unknown'}
          href="/platform/monitoring"
        />
      </div>

      {/* Beta Organizations */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">🏢 Beta Organizations</h2>
          <Link href="/platform/licenses" className="text-xs text-indigo-600 hover:underline">
            Manage Licenses →
          </Link>
        </div>
        {betaLicenses.length > 0 ? (
          <div className="space-y-2">
            {betaLicenses.map((lic: any) => (
              <div key={lic.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    {lic.organization?.name ?? 'Unknown'}
                  </span>
                  <span className="text-xs text-gray-400 ml-2">{lic.license_number}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    lic.status === 'active' ? 'bg-green-50 text-green-600' :
                    lic.status === 'grace' ? 'bg-yellow-50 text-yellow-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {lic.status}
                  </span>
                  <span className="text-xs text-gray-400">
                    {lic.max_users} users
                  </span>
                  <span className="text-xs text-gray-400">
                    {lic.expires_at ? `Expires: ${new Date(lic.expires_at).toLocaleDateString()}` : '∞'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">No beta organizations yet.</p>
        )}
      </div>

      {/* Open Feedback */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">
            💬 Open Feedback ({feedbackStats.open ?? 0})
          </h2>
        </div>
        {openFeedback.length > 0 ? (
          <div className="space-y-2">
            {openFeedback.slice(0, 10).map((fb: any) => (
              <div key={fb.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <TypeBadge type={fb.type} />
                  <span className="text-sm text-gray-900">{fb.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={fb.severity} />
                  <span className="text-xs text-gray-400">
                    {new Date(fb.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">No open feedback.</p>
        )}
      </div>

      {/* Feedback Summary */}
      {feedbackStats.total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(feedbackStats.byType ?? {}).map(([type, count]) => (
            <div key={type} className="bg-white rounded-xl border border-gray-100 p-4">
              <span className="text-xs text-gray-400 block capitalize">{type.replace(/_/g, ' ')}</span>
              <span className="text-xl font-bold text-gray-900">{count as number}</span>
            </div>
          ))}
        </div>
      )}

      {/* Inactive Orgs Warning */}
      {analyticsData?.inactiveOrgs?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-amber-800 mb-2">
            ⚠️ Inactive Organizations ({analyticsData.inactiveOrgs.length})
          </h2>
          <p className="text-xs text-amber-600 mb-3">No user login in the last 30 days</p>
          <div className="space-y-1">
            {analyticsData.inactiveOrgs.slice(0, 5).map((org: any) => (
              <div key={org.id} className="flex items-center justify-between">
                <span className="text-sm text-amber-900">{org.name}</span>
                <span className="text-xs text-amber-500">
                  {org.lastLogin ? new Date(org.lastLogin).toLocaleDateString() : 'Never'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Organization Health & Actions */}
      <OrgHealthPanel />

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Licenses', href: '/platform/licenses', icon: '📜' },
          { label: 'Modules', href: '/platform/modules', icon: '🧩' },
          { label: 'Features', href: '/platform/features', icon: '🚩' },
          { label: 'Diagnostics', href: '/platform/monitoring', icon: '📡' },
          { label: 'Analytics', href: '/platform/analytics', icon: '📊' },
          { label: 'Tenants', href: '/platform/tenants', icon: '🏢' },
          { label: 'Users', href: '/platform/users', icon: '👥' },
          { label: 'Release', href: '/platform/release', icon: '🚀' },
          { label: 'Seed Packs', href: '/platform/seed-packs', icon: '🌱' },
          { label: 'Backups', href: '/platform/backups', icon: '💾' },
          { label: 'Reset', href: '/platform/reset', icon: '🗑️' },
          { label: 'Operations', href: '/platform/operations', icon: '🖥️' },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm hover:border-indigo-200 transition flex items-center gap-3"
          >
            <span className="text-xl">{link.icon}</span>
            <span className="text-sm font-medium text-gray-700">{link.label}</span>
          </Link>
        ))}
      </div>

    </div>
  );
}

function QuickStat({ icon, label, value, color, href }: {
  icon: string; label: string; value: string | number; color?: string; href?: string;
}) {
  const inner = (
    <div className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition">
      <div className="flex items-center gap-2 mb-1">
        <span>{icon}</span>
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <span className="text-2xl font-bold" style={{ color: color ?? '#1f2937' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function TypeBadge({ type }: { type: string }) {
  const icons: Record<string, string> = {
    bug: '🐛', improvement: '💡', feature_request: '✨', question: '❓', general: '💬',
  };
  return <span className="text-sm">{icons[type] ?? '💬'}</span>;
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#6b7280',
  };
  return (
    <span className="text-xs px-2 py-0.5 rounded-full" style={{
      backgroundColor: `${colors[severity] ?? '#6b7280'}15`,
      color: colors[severity] ?? '#6b7280',
    }}>
      {severity}
    </span>
  );
}

function OrgHealthPanel() {
  const { data, mutate: refreshHealth } = useSWR('/api/admin/beta', async (url) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'health' }),
    });
    return res.json();
  });

  const runAction = async (action: string, orgId: string, extra?: Record<string, any>) => {
    if (action === 'clone') {
      const slug = prompt('Enter slug for cloned org:');
      if (!slug) return;
      extra = { ...extra, newSlug: slug, sourceOrgId: orgId };
      orgId = '';
    }
    if (['archive', 'reset', 'suspend'].includes(action)) {
      if (!confirm(`Are you sure you want to ${action} this organization?`)) return;
    }
    await fetch('/api/admin/beta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, orgId: orgId || undefined, ...extra }),
    });
    refreshHealth();
  };

  const orgs = data?.organizations ?? [];
  if (orgs.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">📊 Organization Health & Actions</h2>
      <div className="space-y-3">
        {orgs.map((org: any) => (
          <div key={org.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                org.healthScore >= 80 ? 'bg-green-50 text-green-600' :
                org.healthScore >= 50 ? 'bg-yellow-50 text-yellow-600' :
                'bg-red-50 text-red-600'
              }`}>
                {org.healthScore}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{org.name}</p>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>{org.userCount} users</span>
                  <span>{org.workpackCount} workpacks</span>
                  <span>{org.feedbackCount} feedback</span>
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => runAction('clone', org.id)}
                className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 rounded"
                title="Clone"
              >📋</button>
              <button
                onClick={() => runAction(org.is_active ? 'suspend' : 'activate', org.id)}
                className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 rounded"
                title={org.is_active ? 'Suspend' : 'Activate'}
              >{org.is_active ? '⏸️' : '▶️'}</button>
              <button
                onClick={() => runAction('archive', org.id)}
                className="px-2 py-1 text-xs text-gray-500 hover:bg-red-50 rounded"
                title="Archive"
              >📁</button>
              <button
                onClick={() => runAction('reset', org.id)}
                className="px-2 py-1 text-xs text-gray-500 hover:bg-amber-50 rounded"
                title="Reset"
              >🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

