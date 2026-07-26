'use client';

export const UNIT_TABS = [
  { id: 'overview', label: 'Overview', icon: '📋' },
  { id: 'systems', label: 'Systems', icon: '⚙️' },
  { id: 'equipment', label: 'Equipment', icon: '🏗️' },
  { id: 'workpacks', label: 'Workpacks', icon: '📁' },
  { id: 'schedule', label: 'Schedule Summary', icon: '📅' },
  { id: 'constraints', label: 'Constraints', icon: '⚠️' },
] as const;

export type UnitTabId = (typeof UNIT_TABS)[number]['id'];

interface UnitLayoutProps {
  unit: any;
  activeTab: UnitTabId;
  onTabChange: (tab: UnitTabId) => void;
  children: React.ReactNode;
  kpi?: {
    systems_count: number;
    equipment_count: number;
    workpacks_count: number;
    blinds_count: number;
    open_constraints_count: number;
  };
  event?: { id: string; name: string; code: string | null } | null;
}

const defaultKpi = { systems_count: 0, equipment_count: 0, workpacks_count: 0, blinds_count: 0, open_constraints_count: 0 };
export function UnitLayout({ unit, activeTab, onTabChange, children, kpi = defaultKpi, event: eventInfo }: UnitLayoutProps) {
  const k = kpi as {
    systems_count?: number;
    equipment_count?: number;
    workpacks_count?: number;
    blinds_count?: number;
    open_constraints_count?: number;
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-none bg-white border-b border-gray-200 px-5 py-2.5 flex items-center justify-between gap-4 shadow-sm min-w-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="flex-none font-mono text-base font-bold text-white bg-[#0D2137] px-3 py-1.5 rounded-lg tracking-wider whitespace-nowrap">
            {unit.code ?? unit.id?.slice(0, 8) ?? '—'}
          </span>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-gray-900 truncate leading-tight">{unit.name}</h1>
            <p className="text-xs text-gray-400 truncate leading-tight mt-0.5">
              {unit.plant?.name ?? '—'} · {unit.site?.name ?? '—'}
            </p>
          </div>
          {eventInfo && (
            <span className="flex-none text-xs px-2.5 py-1 rounded-full font-medium bg-blue-100 text-blue-800 whitespace-nowrap truncate max-w-[180px]" title={eventInfo.name}>
              Event: {eventInfo.code ?? eventInfo.name}
            </span>
          )}
          <span className="flex-none text-xs px-2.5 py-1 rounded-full font-medium bg-gray-100 text-gray-600">
            {unit.is_active != null ? (unit.is_active ? 'Active' : 'Inactive') : 'Active'}
          </span>
        </div>
      </div>

      <div className="flex-none px-5 py-2 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-6 text-sm">
        <span className="text-gray-600">
          <strong className="text-gray-900">{k.systems_count ?? 0}</strong> Systems
        </span>
        <span className="text-gray-600">
          <strong className="text-gray-900">{k.equipment_count ?? 0}</strong> Equipment
        </span>
        <span className="text-gray-600">
          <strong className="text-gray-900">{k.workpacks_count ?? 0}</strong> Workpacks
        </span>
        <span className="text-gray-600">
          <strong className="text-gray-900">{k.blinds_count ?? 0}</strong> Blinds
        </span>
        <span className="text-gray-600">
          <strong className="text-gray-900">{k.open_constraints_count ?? 0}</strong> Open Constraints
        </span>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <nav className="flex-none w-44 bg-[#0D2137] flex flex-col overflow-y-auto border-r border-[#162d47]">
          <div className="flex-1 py-2">
            {UNIT_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    onTabChange(tab.id);
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
        <main className="flex-1 min-w-0 overflow-auto bg-gray-50 p-5">{children}</main>
      </div>
    </div>
  );
}
