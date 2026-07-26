'use client';

import { useRouter } from 'next/navigation';

export const SYSTEM_TABS = [
  { id: 'overview', label: 'Overview', icon: '📋' },
  { id: 'blinds', label: 'Blind List', icon: '🔩' },
  { id: 'gaskets', label: 'Gasket Register', icon: '📦' },
  { id: 'drawings', label: 'Drawings & P&IDs', icon: '📐' },
  { id: 'procedures', label: 'Procedures / JSA', icon: '📄' },
  { id: 'lines', label: 'Line List', icon: '〰️' },
  { id: 'equipment', label: 'Equipment List', icon: '🏗️' },
  { id: 'workpacks', label: 'Workpacks', icon: '📁' },
  { id: 'schedule', label: 'Schedule (HO/WP/TO)', icon: '📅' },
  { id: 'wbs', label: 'WBS', icon: '⚙️' },
] as const;

export type SystemTabId = (typeof SYSTEM_TABS)[number]['id'];

interface SystemLayoutProps {
  system: any;
  activeTab: SystemTabId;
  onTabChange: (tab: SystemTabId) => void;
  children: React.ReactNode;
  counts?: { blinds?: number; gaskets?: number; workpacks?: number; lines?: number; assets?: number };
}

export function SystemLayout({ system, activeTab, onTabChange, children, counts = {} }: SystemLayoutProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-none bg-white border-b border-gray-200 px-5 py-2.5 flex items-center justify-between gap-4 shadow-sm min-w-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="flex-none font-mono text-base font-bold text-white bg-[#0D2137] px-3 py-1.5 rounded-lg tracking-wider whitespace-nowrap">
            {system.code ?? system.id.slice(0, 8)}
          </span>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-gray-900 truncate leading-tight">{system.name}</h1>
            <p className="text-xs text-gray-400 truncate leading-tight mt-0.5">
              {system.unit?.name ?? '—'} · {system.site?.name ?? '—'}
            </p>
          </div>
          {system.criticality && (
            <span
              className={`flex-none text-xs px-2.5 py-1 rounded-full font-medium ${
                system.criticality === 'High' ? 'bg-red-100 text-red-700' : system.criticality === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {system.criticality}
            </span>
          )}
          <span className="flex-none text-xs px-2.5 py-1 rounded-full font-medium bg-gray-100 text-gray-600">
            {system.status}
          </span>
        </div>
      </div>

      <div className="flex-none px-5 py-2 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-6 text-sm">
        <span className="text-gray-600">
          <strong className="text-gray-900">{counts.blinds ?? 0}</strong> Blinds
        </span>
        <span className="text-gray-600">
          <strong className="text-gray-900">{counts.gaskets ?? 0}</strong> Gaskets
        </span>
        <span className="text-gray-600">
          <strong className="text-gray-900">{counts.workpacks ?? 0}</strong> Workpacks
        </span>
        <span className="text-gray-600">
          <strong className="text-gray-900">{counts.lines ?? 0}</strong> Lines
        </span>
        <span className="text-gray-600">
          <strong className="text-gray-900">{counts.assets ?? 0}</strong> Equipment
        </span>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <nav className="flex-none w-44 bg-[#0D2137] flex flex-col overflow-y-auto border-r border-[#162d47]">
          <div className="flex-1 py-2">
            {SYSTEM_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    onTabChange(tab.id);
                    if (tab.id === 'wbs') {
                      router.push(`/planning/systems/${system.id}/wbs`);
                      return;
                    }
                    if (typeof window !== 'undefined') window.history.replaceState(null, '', `#${tab.id}`);
                  }}
                  className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors relative ${
                    isActive ? 'bg-white/15 text-white font-medium' : 'text-gray-400 hover:bg-white/8 hover:text-gray-200'
                  }`}
                >
                  {isActive && <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-blue-400 rounded-r-full" />}
                  <span className="text-base">{tab.icon}</span>
                  <span className="text-xs flex-1 truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-50">
          <div className="p-5 min-h-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
