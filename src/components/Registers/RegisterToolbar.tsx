'use client';

import { Layers, Maximize2, Minimize2, Search } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────

export type FilterDef = {
    key: string;
    label: string;
    options: string[]; // first is "all" empty string
};

type RegisterToolbarProps = {
    // Group-by
    groupMode: string;
    groupOptions: { value: string; label: string }[];
    onGroupModeChange: (v: string) => void;
    // Expand / collapse
    onExpandAll: () => void;
    onCollapseAll: () => void;
    // Search
    searchTerm: string;
    searchPlaceholder?: string;
    onSearchChange: (v: string) => void;
    // Dynamic filters
    filters: Record<string, string>;
    filterDefs: FilterDef[];
    onFilterChange: (key: string, value: string) => void;
    // Export
    onExportCsv?: () => void;
};

// ── Component ────────────────────────────────────────────────────────────

export function RegisterToolbar({
    groupMode,
    groupOptions,
    onGroupModeChange,
    onExpandAll,
    onCollapseAll,
    searchTerm,
    searchPlaceholder = 'Search...',
    onSearchChange,
    filters,
    filterDefs,
    onFilterChange,
    onExportCsv,
}: RegisterToolbarProps) {
    return (
        <div className="bg-white border border-gray-200 rounded-xl p-3 mb-4 shadow-sm space-y-3">
            {/* Row 1: group-by, expand/collapse, filters, export */}
            <div className="flex flex-wrap items-center gap-2">
                {/* Group By */}
                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
                    <Layers className="text-gray-400 w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Group</span>
                    <select
                        value={groupMode}
                        onChange={(e) => onGroupModeChange(e.target.value)}
                        className="text-xs font-medium text-gray-800 bg-transparent outline-none cursor-pointer"
                    >
                        {groupOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                </div>

                {/* Expand / Collapse */}
                <button
                    type="button"
                    onClick={onExpandAll}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                >
                    <Maximize2 size={12} />
                    Expand
                </button>
                <button
                    type="button"
                    onClick={onCollapseAll}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                >
                    <Minimize2 size={12} />
                    Collapse
                </button>

                {/* Divider */}
                <div className="w-px h-5 bg-gray-200 mx-1" />

                {/* Dynamic Filters */}
                {filterDefs.map((f) => (
                    <select
                        key={f.key}
                        value={filters[f.key] ?? ''}
                        onChange={(e) => onFilterChange(f.key, e.target.value)}
                        className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 outline-none cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                        <option value="">{f.label}: All</option>
                        {f.options.map((o) => (
                            <option key={o} value={o}>
                                {o.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                            </option>
                        ))}
                    </select>
                ))}

                {/* Spacer + Export */}
                {onExportCsv && (
                    <button
                        type="button"
                        onClick={onExportCsv}
                        className="ml-auto flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                        ⬇ Export CSV
                    </button>
                )}
            </div>

            {/* Row 2: Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                <input
                    type="text"
                    placeholder={searchPlaceholder}
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
                {searchTerm && (
                    <button
                        type="button"
                        onClick={() => onSearchChange('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
                    >
                        ×
                    </button>
                )}
            </div>
        </div>
    );
}
