'use client';

/**
 * M7.6G — Release Management Page
 */

import useSWR from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
};

export default function ReleasePage() {
  const { data, error } = useSWR('/api/admin/release', fetcher);

  if (error) return <div className="p-8 text-red-500">Failed to load release info.</div>;
  if (!data) return <div className="p-8 text-gray-500 animate-pulse">Loading release info...</div>;

  const channelColors: Record<string, string> = {
    production: '#10b981', beta: '#8b5cf6', development: '#f59e0b', rc: '#3b82f6',
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Release Management</h1>
        <p className="text-sm text-gray-500 mt-1">Current deployment information</p>
      </div>

      {/* Version Banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white">
        <p className="text-sm text-indigo-200 mb-1">Current Version</p>
        <h2 className="text-4xl font-bold mb-2">v{data.version}</h2>
        <div className="flex items-center gap-4 mt-3">
          <span
            className="px-3 py-1 rounded-full text-xs font-semibold uppercase"
            style={{
              backgroundColor: `${channelColors[data.releaseChannel] ?? '#6b7280'}30`,
              color: '#fff',
            }}
          >
            {data.releaseChannel}
          </span>
          <span className="text-sm text-indigo-200">{data.environment}</span>
        </div>
      </div>

      {/* Build Info */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Build Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <InfoRow label="Git Commit" value={data.gitCommit} mono />
          <InfoRow label="Build Number" value={data.buildNumber} />
          <InfoRow label="Build Timestamp" value={new Date(data.buildTimestamp).toLocaleString()} />
          <InfoRow label="Node.js" value={data.nodeVersion} mono />
        </div>
      </div>

      {/* Database Schema */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Database Schema</h3>
        <div className="grid grid-cols-2 gap-4">
          <InfoRow label="Schema Version" value={data.schemaVersion} />
          <InfoRow label="Total Migrations" value={data.totalMigrations} />
          <InfoRow label="Last Migration" value={data.lastMigration ?? 'None'} mono />
        </div>
      </div>

      {/* Release Channels */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Release Channels</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { name: 'Production', key: 'production', icon: '🟢' },
            { name: 'Beta', key: 'beta', icon: '🟣' },
            { name: 'Release Candidate', key: 'rc', icon: '🔵' },
            { name: 'Development', key: 'development', icon: '🟡' },
          ].map((ch) => (
            <div
              key={ch.key}
              className={`rounded-lg p-3 border transition ${
                data.releaseChannel === ch.key
                  ? 'border-indigo-300 bg-indigo-50'
                  : 'border-gray-100 bg-gray-50'
              }`}
            >
              <span className="text-lg">{ch.icon}</span>
              <p className="text-xs font-medium text-gray-700 mt-1">{ch.name}</p>
              {data.releaseChannel === ch.key && (
                <p className="text-xs text-indigo-600 mt-0.5">Current</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div>
      <span className="text-xs text-gray-400 block">{label}</span>
      <span className={`text-sm font-medium text-gray-900 ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}
