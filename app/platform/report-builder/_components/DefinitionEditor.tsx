'use client';

import useSWR from 'swr';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function DefinitionEditor() {
  const { data, isLoading, mutate } = useSWR('/api/report-builder/definitions', fetcher);

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate this report definition?')) return;
    await fetch(`/api/report-builder/definitions/${id}`, { method: 'DELETE' });
    mutate();
  };

  const definitions = data?.definitions ?? [];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/platform/report-builder" className="text-gray-400 hover:text-gray-600">←</Link>
          <div>
            <h1 className="text-xl font-bold text-[#0D2137]">Report Definitions</h1>
            <p className="text-sm text-gray-500 mt-1">{definitions.length} definitions</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Data Source</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Sections</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {definitions.map((d: any) => (
                  <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-[#0D2137]">{d.name}</div>
                      <div className="text-xs text-gray-400">{d.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">{d.category?.icon} {d.category?.name}</td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">{d.data_source_key}</code>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{d.sections?.length ?? d._count?.sections ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${d.is_system ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {d.is_system ? 'System' : 'Custom'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${d.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {d.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!d.is_system && (
                        <button
                          onClick={() => handleDelete(d.id)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
