'use client';

/**
 * M7.6G.1 — Operations Console
 *
 * Unified platform admin dashboard for system-wide monitoring.
 * All data sourced from existing services:
 * DiagnosticsService, AnalyticsService, LicenseService, ReleaseService, BackupService
 */

import useSWR from 'swr';
import Link from 'next/link';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok) return null;
  return data;
};

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function OperationsConsolePage() {
  const { data: diagnostics } = useSWR('/api/admin/diagnostics', fetcher, { refreshInterval: 30000 });
  const { data: analytics } = useSWR('/api/admin/analytics', fetcher, { refreshInterval: 30000 });
  const { data: licenseData } = useSWR('/api/admin/licenses', fetcher, { refreshInterval: 60000 });
  const { data: backupData } = useSWR('/api/admin/backups', fetcher, { refreshInterval: 60000 });
  const { data: releaseData } = useSWR('/api/admin/releases', fetcher, { refreshInterval: 60000 });
  const { data: feedbackData } = useSWR('/api/admin/feedback?status=open', fetcher, { refreshInterval: 30000 });
  const { data: seedPackData } = useSWR('/api/admin/seed-packs', fetcher, { refreshInterval: 60000 });

  const health = diagnostics?.health;
  const infra = diagnostics?.infrastructure ?? {};
  const licenses = licenseData?.licenses ?? [];
  const backups = backupData?.items ?? [];
  const backupStats = backupData?.stats ?? {};
  const releases = releaseData?.releases ?? [];
  const openFeedback = feedbackData?.items ?? [];
  const seedPacks = seedPackData?.packs ?? [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Operations Console</h1>
          <p className="text-sm text-gray-500 mt-1">Unified platform monitoring • Auto-refresh: 30s</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          health?.overall === 'healthy' ? 'bg-green-50 text-green-600' :
          health?.overall === 'degraded' ? 'bg-yellow-50 text-yellow-600' :
          'bg-red-50 text-red-600'
        }`}>
          {health?.overall === 'healthy' ? '🟢' : health?.overall === 'degraded' ? '🟡' : '🔴'} {health?.overall ?? 'checking...'}
        </span>
      </div>

      {/* Row 1: Primary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <OpsCard icon="🏢" label="Organizations" value={analytics?.totalOrgs ?? '—'} href="/platform/tenants" />
        <OpsCard icon="👥" label="Total Users" value={analytics?.totalUsers ?? '—'} href="/platform/users" />
        <OpsCard icon="📊" label="DAU" value={analytics?.dau ?? '—'} />
        <OpsCard icon="📈" label="MAU" value={analytics?.mau ?? '—'} />
        <OpsCard icon="💬" label="Open Feedback" value={openFeedback.length} color={openFeedback.length > 0 ? '#f59e0b' : undefined} />
        <OpsCard icon="🌱" label="Seed Packs" value={seedPacks.length} href="/platform/seed-packs" />
      </div>

      {/* Row 2: Infrastructure */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Database */}
        <Section title="🗄️ Database" href="/platform/monitoring">
          <InfoRow label="Status" value={infra.database?.connected ? '🟢 Connected' : '🔴 Disconnected'} />
          <InfoRow label="Latency" value={infra.database?.latencyMs ? `${infra.database.latencyMs}ms` : '—'} />
          <InfoRow label="Migrations" value={infra.database?.migrationVersion ?? '—'} />
        </Section>

        {/* Redis */}
        <Section title="⚡ Redis">
          <InfoRow label="Status" value={infra.redis?.connected ? '🟢 Connected' : '🟡 Not configured'} />
          <InfoRow label="Memory" value={infra.redis?.usedMemory ?? '—'} />
          <InfoRow label="Keys" value={infra.redis?.keys ?? '—'} />
        </Section>

        {/* SMTP */}
        <Section title="📧 SMTP">
          <InfoRow label="Status" value={infra.smtp?.configured ? '🟢 Configured' : '🟡 Not configured'} />
          <InfoRow label="Host" value={infra.smtp?.host ?? '—'} />
        </Section>

        {/* AI */}
        <Section title="🤖 AI Provider">
          <InfoRow label="Status" value={infra.ai?.configured ? '🟢 Configured' : '🟡 Not configured'} />
          <InfoRow label="Provider" value={infra.ai?.provider ?? '—'} />
          <InfoRow label="Model" value={infra.ai?.model ?? '—'} />
        </Section>

        {/* Build */}
        <Section title="🏗️ Build Info">
          <InfoRow label="Version" value={diagnostics?.version ?? '—'} />
          <InfoRow label="Commit" value={diagnostics?.commit ? diagnostics.commit.slice(0, 8) : '—'} />
          <InfoRow label="Environment" value={diagnostics?.environment ?? '—'} />
          <InfoRow label="Channel" value={releaseData?.activeChannel ?? '—'} />
        </Section>

        {/* Storage */}
        <Section title="💾 Storage">
          <InfoRow label="Backups" value={backupStats.total ?? 0} />
          <InfoRow label="Backup Size" value={formatBytes(backupStats.totalSizeBytes ?? 0)} />
          <InfoRow label="Last Backup" value={backupStats.lastBackup ? new Date(backupStats.lastBackup).toLocaleDateString() : 'Never'} />
        </Section>
      </div>

      {/* Row 3: Licenses */}
      <Section title="📜 Licenses" href="/platform/licenses">
        {licenses.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(() => {
              const byType: Record<string, number> = {};
              for (const l of licenses) {
                byType[l.license_type] = (byType[l.license_type] ?? 0) + 1;
              }
              return Object.entries(byType).map(([type, count]) => (
                <div key={type} className="bg-gray-50 rounded-lg p-3">
                  <span className="text-xs text-gray-400 capitalize block">{type}</span>
                  <span className="text-lg font-bold text-gray-900">{count}</span>
                </div>
              ));
            })()}
          </div>
        ) : (
          <p className="text-xs text-gray-400">No licenses found.</p>
        )}
      </Section>

      {/* Row 4: Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent Backups */}
        <Section title="💾 Recent Backups" href="/platform/backups">
          {backups.length > 0 ? (
            <div className="space-y-2">
              {backups.slice(0, 5).map((b: any) => (
                <div key={b.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span>{b.status === 'completed' ? '✅' : b.status === 'failed' ? '❌' : '⏳'}</span>
                    <span className="text-gray-700">{b.name}</span>
                  </div>
                  <span className="text-gray-400">
                    {formatBytes(Number(b.file_size_bytes ?? 0))} • {new Date(b.started_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">No backups yet.</p>
          )}
        </Section>

        {/* Recent Feedback */}
        <Section title="💬 Open Feedback" href="/platform/beta">
          {openFeedback.length > 0 ? (
            <div className="space-y-2">
              {openFeedback.slice(0, 5).map((fb: any) => (
                <div key={fb.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700">{fb.title}</span>
                  <span className={`px-2 py-0.5 rounded-full ${
                    fb.severity === 'critical' ? 'bg-red-50 text-red-600' :
                    fb.severity === 'high' ? 'bg-yellow-50 text-yellow-600' :
                    'bg-gray-50 text-gray-500'
                  }`}>
                    {fb.severity}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">No open feedback.</p>
          )}
        </Section>
      </div>

      {/* Row 5: Component Health */}
      {health?.components && (
        <Section title="🔧 Component Health">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(health.components).map(([name, status]) => (
              <div key={name} className="bg-gray-50 rounded-lg p-3 flex items-center gap-2">
                <span>{status === 'healthy' ? '🟢' : status === 'degraded' ? '🟡' : '🔴'}</span>
                <span className="text-sm text-gray-700 capitalize">{name.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ─── Components ─────────────────────────────────────────────────────────────

function OpsCard({ icon, label, value, color, href }: {
  icon: string; label: string; value: string | number; color?: string; href?: string;
}) {
  const inner = (
    <div className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition">
      <div className="flex items-center gap-2 mb-1">
        <span>{icon}</span>
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <span className="text-xl font-bold" style={{ color: color ?? '#1f2937' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function Section({ title, href, children }: {
  title: string; href?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
        {href && <Link href={href} className="text-xs text-indigo-600 hover:underline">View →</Link>}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-gray-700">{String(value)}</span>
    </div>
  );
}
