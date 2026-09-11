'use client';

/**
 * M7.6H — Platform Diagnostics Dashboard (Enhanced)
 *
 * Full diagnostics view with enhanced application info, DB metrics,
 * and SMTP source tracking.
 */

import useSWR from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
};

const STATUS_ICONS: Record<string, string> = {
  healthy: '🟢',
  degraded: '🟡',
  down: '🔴',
  unknown: '⚪',
};

export default function PlatformMonitoringPage() {
  const { data, error, mutate } = useSWR('/api/admin/diagnostics', fetcher, { refreshInterval: 30000 });

  if (error) return <div className="p-8 text-red-500 font-medium">Failed to load diagnostics.</div>;
  if (!data) return <div className="p-8 text-gray-500 animate-pulse font-medium">Running diagnostics...</div>;

  const d = data;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Diagnostics</h1>
          <p className="text-sm text-gray-500 mt-1">
            Last scan: {new Date(d.timestamp).toLocaleTimeString()} · Auto-refresh: 30s
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{STATUS_ICONS[d.health.overall]}</span>
          <span className={`text-sm font-semibold uppercase ${
            d.health.overall === 'healthy' ? 'text-green-600' :
            d.health.overall === 'degraded' ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {d.health.overall}
          </span>
          <button
            onClick={() => mutate()}
            className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Application Info */}
      <Section title="Application" icon="📦">
        <InfoGrid items={[
          { label: 'Version', value: d.application.version },
          { label: 'Environment', value: d.application.environment },
          { label: 'Node ENV', value: d.application.nodeEnv },
          { label: 'Git Commit', value: (d.application.gitCommit || 'unknown').substring(0, 8) },
          { label: 'Git Branch', value: d.application.gitBranch || 'unknown' },
          { label: 'Build', value: d.application.buildNumber },
          { label: 'Build Date', value: d.application.buildDate || '—' },
          { label: 'Docker Image', value: d.application.dockerImage || 'local' },
          { label: 'Uptime', value: formatUptime(d.application.uptime) },
        ]} />
      </Section>

      {/* Infrastructure */}
      <Section title="Infrastructure" icon="🏗️">
        <InfoGrid items={[
          { label: 'Node.js', value: d.infrastructure.nodeVersion },
          { label: 'Platform', value: `${d.infrastructure.platform} / ${d.infrastructure.arch}` },
          { label: 'Prisma', value: d.infrastructure.prismaVersion },
        ]} />
      </Section>

      {/* Component Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ComponentCard
          title="Database"
          icon="🗄️"
          status={d.database.status}
          latency={d.database.latencyMs}
          details={d.database.details}
          error={d.database.error}
        />
        <ComponentCard
          title="Redis"
          icon="⚡"
          status={d.redis.status}
          latency={d.redis.latencyMs}
          details={d.redis.details}
          error={d.redis.error}
        />
        <ComponentCard
          title="SMTP"
          icon="📧"
          status={d.smtp.status}
          details={d.smtp.details}
          error={d.smtp.error}
        />
        <ComponentCard
          title="AI Provider"
          icon="🤖"
          status={d.ai.configured ? 'healthy' : 'unknown'}
          details={{
            provider: d.ai.provider ?? 'Not configured',
            model: d.ai.model ?? '—',
          }}
        />
      </div>

      {/* Memory */}
      <Section title="Memory" icon="💾">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Heap Used" value={`${d.memory.heapUsedMB} MB`} />
          <MetricCard label="Heap Total" value={`${d.memory.heapTotalMB} MB`} />
          <MetricCard label="RSS" value={`${d.memory.rssMB} MB`} />
          <MetricCard label="Heap Usage" value={`${d.memory.heapUsagePercent}%`}
            color={d.memory.heapUsagePercent > 85 ? '#ef4444' : d.memory.heapUsagePercent > 70 ? '#f59e0b' : '#10b981'}
          />
        </div>
      </Section>

      {/* Queues */}
      <Section title="Background Queues" icon="📬">
        {d.queues.queues.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Queue</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-500">Waiting</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-500">Active</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-500">Completed</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-500">Failed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {d.queues.queues.map((q: any) => (
                  <tr key={q.name}>
                    <td className="px-4 py-2 font-medium text-gray-900">{q.name}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{q.waiting}</td>
                    <td className="px-4 py-2 text-right text-blue-600">{q.active}</td>
                    <td className="px-4 py-2 text-right text-green-600">{q.completed}</td>
                    <td className={`px-4 py-2 text-right ${q.failed > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                      {q.failed >= 0 ? q.failed : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No queue data available.</p>
        )}
      </Section>

      {/* Storage */}
      <Section title="Storage" icon="💿">
        <InfoGrid items={[
          { label: 'Upload Directory', value: d.storage.uploadDir },
          { label: 'Documents', value: d.storage.totalDocuments.toLocaleString() },
          { label: 'Attachments', value: d.storage.totalAttachments.toLocaleString() },
        ]} />
      </Section>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <span>{icon}</span> {title}
      </h2>
      {children}
    </div>
  );
}

function InfoGrid({ items }: { items: Array<{ label: string; value: string | number }> }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {items.map((item) => (
        <div key={item.label}>
          <span className="text-xs text-gray-400 block">{item.label}</span>
          <span className="text-sm font-medium text-gray-900">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function ComponentCard({ title, icon, status, latency, details, error }: {
  title: string; icon: string; status: string;
  latency?: number; details?: Record<string, any>; error?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <span>{icon}</span> {title}
        </h3>
        <span className="text-lg">{STATUS_ICONS[status] ?? '⚪'}</span>
      </div>
      {latency !== undefined && (
        <p className="text-xs text-gray-500">Latency: {latency}ms</p>
      )}
      {details && Object.entries(details).map(([k, v]) => (
        <p key={k} className="text-xs text-gray-500">
          <span className="capitalize">{k.replace(/_/g, ' ')}</span>: {String(v)}
        </p>
      ))}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <span className="text-xs text-gray-400 block">{label}</span>
      <span className="text-lg font-bold" style={{ color: color ?? '#1f2937' }}>{value}</span>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
