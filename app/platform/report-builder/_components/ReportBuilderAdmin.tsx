'use client';

import useSWR from 'swr';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function ReportBuilderAdmin() {
  const { data: catData } = useSWR('/api/report-builder/categories', fetcher);
  const { data: defData } = useSWR('/api/report-builder/definitions', fetcher);
  const { data: layoutData } = useSWR('/api/report-builder/layouts', fetcher);
  const { data: genData } = useSWR('/api/report-builder/generations?limit=10', fetcher);

  const categories = catData?.categories ?? [];
  const definitions = defData?.definitions ?? [];
  const layouts = layoutData?.layouts ?? [];
  const recentGens = genData?.generations ?? [];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <h1 className="text-xl font-bold text-[#0D2137]">🛠️ Report Builder — Platform Admin</h1>
        <p className="text-sm text-gray-500 mt-1">Manage report definitions, layouts, and system configuration</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Categories', value: categories.length, icon: '📁', color: '#2563EB' },
            { label: 'Definitions', value: definitions.length, icon: '📊', color: '#059669' },
            { label: 'Layouts', value: layouts.length, icon: '🖼️', color: '#7C3AED' },
            { label: 'Recent Generations', value: recentGens.length, icon: '📄', color: '#E8701A' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{stat.icon}</div>
                <div>
                  <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
                  <div className="text-xs text-gray-500 font-medium">{stat.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/platform/report-builder/definitions"
            className="bg-white rounded-xl border border-gray-200 p-5 hover:border-[#E8701A] hover:shadow-lg transition-all group"
          >
            <h3 className="font-semibold text-[#0D2137] group-hover:text-[#E8701A]">📊 Manage Definitions</h3>
            <p className="text-sm text-gray-500 mt-2">Create, edit, and manage report definitions. Configure data sources, sections, and parameters.</p>
            <div className="text-xs text-gray-400 mt-3">{definitions.length} definitions configured</div>
          </Link>
          <Link
            href="/platform/report-builder/layouts"
            className="bg-white rounded-xl border border-gray-200 p-5 hover:border-[#E8701A] hover:shadow-lg transition-all group"
          >
            <h3 className="font-semibold text-[#0D2137] group-hover:text-[#E8701A]">🖼️ Manage Layouts</h3>
            <p className="text-sm text-gray-500 mt-2">Create custom report layouts with branding, headers, footers, and page configuration.</p>
            <div className="text-xs text-gray-400 mt-3">{layouts.length} layouts configured</div>
          </Link>
        </div>

        {/* Recent Generations */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-[#0D2137]">Recent Generations</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {recentGens.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">No reports generated yet</div>
            ) : (
              recentGens.map((g: any) => (
                <div key={g.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-700">
                      {g.definition?.category?.icon} {g.definition?.name}
                    </div>
                    <div className="text-xs text-gray-400">{new Date(g.created_at).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      g.status === 'completed' ? 'bg-green-100 text-green-700' :
                      g.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {g.status}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{g.output_format?.toUpperCase()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
