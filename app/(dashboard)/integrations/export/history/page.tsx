'use client';

import { useState, useEffect } from 'react';

const FORMAT_LABELS: Record<
  string,
  { label: string; icon: string }
> = {
  csv: { label: 'Excel / CSV', icon: '📊' },
  msproject_xml: { label: 'MS Project XML', icon: '📋' },
  p6_xer: { label: 'Primavera P6 XER', icon: '⚙️' },
  p6_xml: { label: 'Primavera P6 XML', icon: '🔧' },
};

export default function ExportHistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/export/history')
      .then((r) => r.json())
      .then((d) => {
        setHistory(Array.isArray(d) ? d : []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Export History</h1>
      <p className="text-sm text-gray-500 mb-6">
        All previous schedule exports from this organisation
      </p>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400 text-sm">
            Loading history…
          </div>
        ) : history.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-4xl mb-3">🕐</p>
            <p className="text-gray-500 font-medium">No exports yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Your export history will appear here after your first download
            </p>
            <a
              href="/integrations/export"
              className="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
            >
              Go to Export →
            </a>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {[
                  'Format',
                  'Filename',
                  'Workpacks',
                  'Activities',
                  'Size',
                  'Exported',
                  'By',
                ].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map((h: any) => {
                const fmt = FORMAT_LABELS[h.format] ?? {
                  label: h.format,
                  icon: '📄',
                };
                return (
                  <tr key={h.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2 text-sm font-medium text-gray-900">
                        <span>{fmt.icon}</span>
                        {fmt.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs font-mono text-gray-500 max-w-[200px] truncate">
                      {h.filename}
                    </td>
                    <td className="px-5 py-3 text-sm text-center font-semibold text-gray-700">
                      {h.workpackCount ?? h.workpack_count}
                    </td>
                    <td className="px-5 py-3 text-sm text-center font-semibold text-gray-700">
                      {h.activityCount ?? h.activity_count}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400">
                      {h.fileSizeBytes != null
                        ? `${Math.round((h.fileSizeBytes ?? h.file_size_bytes ?? 0) / 1024)} KB`
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(
                        h.exportedAt ?? h.exported_at
                      ).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500">
                      {h.exportedBy ?? h.exported_by ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
