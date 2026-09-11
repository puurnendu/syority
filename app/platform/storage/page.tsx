'use client';

/**
 * M7.6H — Platform Storage Overview
 *
 * Replaces Coming Soon with real storage metrics from DiagnosticsService.
 */

import useSWR from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
};

export default function PlatformStoragePage() {
  const { data, error } = useSWR('/api/admin/diagnostics', fetcher, { refreshInterval: 60000 });

  if (error) return <div className="p-8 text-red-500 font-medium">Failed to load storage data.</div>;
  if (!data) return <div className="p-8 text-gray-500 animate-pulse font-medium">Loading storage data...</div>;

  const storage = data.storage;

  const cards = [
    { label: 'Documents', value: storage.totalDocuments, icon: '📄', color: 'border-blue-200 bg-blue-50/60' },
    { label: 'Attachments', value: storage.totalAttachments, icon: '📎', color: 'border-emerald-200 bg-emerald-50/60' },
    { label: 'Total Files', value: storage.totalDocuments + storage.totalAttachments, icon: '🗂️', color: 'border-violet-200 bg-violet-50/60' },
    { label: 'Upload Directory', value: storage.uploadDir, icon: '📁', color: 'border-amber-200 bg-amber-50/60', isText: true },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Storage</h1>
        <p className="text-sm text-gray-500 mt-1">Platform-wide storage overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border p-5 ${card.color}`}
          >
            <div className="text-2xl mb-2">{card.icon}</div>
            <div className={`${(card as any).isText ? 'text-sm' : 'text-3xl'} font-black text-gray-900 tabular-nums`}>
              {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
            </div>
            <div className="mt-1 text-sm font-semibold text-gray-800">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Storage Configuration</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Upload Directory</span>
            <span className="font-mono text-gray-700">{storage.uploadDir}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">S3 Bucket</span>
            <span className="font-mono text-gray-700">{process.env.NEXT_PUBLIC_S3_BUCKET ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-gray-500">Storage Provider</span>
            <span className="font-mono text-gray-700">
              {process.env.NEXT_PUBLIC_STORAGE_PROVIDER ?? 'local'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
