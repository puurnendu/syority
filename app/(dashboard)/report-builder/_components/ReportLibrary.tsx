'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  userRole: string;
  canBuild: boolean;
  canAdmin: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  planning: '#2563EB',
  shutdown: '#DC2626',
  execution: '#059669',
  management: '#7C3AED',
  platform: '#0D2137',
};

export function ReportLibrary({ userRole, canBuild, canAdmin }: Props) {
  const { data, error, isLoading } = useSWR('/api/report-builder/library', fetcher);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#E8701A] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Loading Report Library...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-center text-red-500 font-medium">Error loading report library</div>;
  }

  const library = data?.library ?? [];
  const filtered = library
    .map((cat: any) => ({
      ...cat,
      definitions: cat.definitions.filter((d: any) =>
        (!search || d.name.toLowerCase().includes(search.toLowerCase()) || d.description?.toLowerCase().includes(search.toLowerCase())) &&
        (!activeCategory || cat.slug === activeCategory)
      ),
    }))
    .filter((cat: any) => cat.definitions.length > 0);

  const totalReports = library.reduce((sum: number, cat: any) => sum + cat.definitions.length, 0);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-[#0D2137]">Report Builder</h1>
          <p className="text-sm text-gray-500 mt-1">{totalReports} reports available across {library.length} categories</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/report-builder/history"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            📋 History
          </Link>
          {canBuild && (
            <Link
              href="/report-builder/schedules"
              className="px-4 py-2 text-sm font-medium text-white bg-[#0D2137] rounded-lg hover:bg-[#1a3a5c] transition-colors"
            >
              ⏰ Schedules
            </Link>
          )}
        </div>
      </div>

      {/* Search + Category Filter */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex gap-4 items-center flex-shrink-0">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search reports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8701A] focus:border-transparent"
          />
          <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              !activeCategory ? 'bg-[#0D2137] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {library.map((cat: any) => (
            <button
              key={cat.slug}
              onClick={() => setActiveCategory(activeCategory === cat.slug ? null : cat.slug)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                activeCategory === cat.slug
                  ? 'text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              style={activeCategory === cat.slug ? { backgroundColor: CATEGORY_COLORS[cat.slug] ?? '#6B7280' } : {}}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Report Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-4">📊</div>
            <p className="text-lg font-medium">No reports found</p>
            <p className="text-sm mt-1">Try adjusting your search or filter</p>
          </div>
        )}

        {filtered.map((cat: any) => (
          <div key={cat.id} className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-1 h-6 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[cat.slug] ?? '#6B7280' }}
              />
              <h2 className="text-lg font-bold text-[#0D2137]">{cat.icon} {cat.name}</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{cat.definitions.length} reports</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {cat.definitions.map((def: any) => (
                <Link
                  key={def.id}
                  href={`/report-builder/${def.id}`}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:border-[#E8701A] hover:shadow-lg transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-[#0D2137] group-hover:text-[#E8701A] transition-colors">{def.name}</h3>
                    {def.supports_ai_summary && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">🤖 AI</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-2 line-clamp-2">{def.description ?? 'No description'}</p>
                  <div className="flex items-center gap-4 mt-4 text-xs text-gray-400">
                    <span title="Output formats">📄 {(def.supports_outputs ?? ['pdf']).join(', ').toUpperCase()}</span>
                    <span title="Parameters">🔧 {def.parameters?.length ?? 0} params</span>
                    <span title="Sections">📑 {def.sections?.length ?? 0} sections</span>
                  </div>
                  {def._count && (
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span>📊 {def._count.generations ?? 0} generated</span>
                      <span>⏰ {def._count.schedules ?? 0} scheduled</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
