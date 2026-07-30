'use client';

import useSWR from 'swr';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function LayoutManager() {
  const { data, isLoading, mutate } = useSWR('/api/report-builder/layouts', fetcher);

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate this layout?')) return;
    await fetch(`/api/report-builder/layouts/${id}`, { method: 'DELETE' });
    mutate();
  };

  const layouts = data?.layouts ?? [];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/platform/report-builder" className="text-gray-400 hover:text-gray-600">←</Link>
          <div>
            <h1 className="text-xl font-bold text-[#0D2137]">Report Layouts</h1>
            <p className="text-sm text-gray-500 mt-1">{layouts.length} layouts</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {layouts.map((l: any) => (
              <div key={l.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-[#0D2137]">{l.name}</h3>
                    <p className="text-xs text-gray-400 mt-1">{l.slug}</p>
                  </div>
                  {l.is_system && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">System</span>
                  )}
                </div>

                {/* Color Preview */}
                <div className="flex gap-2 mt-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: l.primary_color ?? '#0D2137' }} />
                    <span className="text-xs text-gray-400">Primary</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: l.accent_color ?? '#E8701A' }} />
                    <span className="text-xs text-gray-400">Accent</span>
                  </div>
                </div>

                {/* Settings */}
                <div className="flex flex-wrap gap-2 mt-3 text-xs text-gray-500">
                  <span className="bg-gray-100 px-2 py-0.5 rounded">{l.page_size}</span>
                  <span className="bg-gray-100 px-2 py-0.5 rounded">{l.orientation}</span>
                  <span className="bg-gray-100 px-2 py-0.5 rounded">{l.font_size_base}px</span>
                  {l.show_signature && <span className="bg-gray-100 px-2 py-0.5 rounded">✍️ Signature</span>}
                </div>

                {/* Actions */}
                {!l.is_system && (
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleDelete(l.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Deactivate
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
