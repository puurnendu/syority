'use client';

import { useState, useMemo, Fragment, useCallback } from 'react';
import { groupByHierarchy, sortNumericKeys, getGroupCount } from '@/lib/utils/grouping';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { RegisterToolbar } from './RegisterToolbar';
import { RegisterSummaryBar } from './RegisterSummaryBar';

// ── Types ────────────────────────────────────────────────────────────────

interface CentralBlindRegisterProps {
    initialItems: any[];
}

type GroupMode = 'none' | 'size' | 'rating' | 'size-rating' | 'workpack';

// ── Status color map ─────────────────────────────────────────────────────

const STATUS_CLASSES: Record<string, string> = {
    inserted: 'bg-orange-100 text-orange-700',
    removed: 'bg-blue-100 text-blue-700',
    verified: 'bg-green-100 text-green-700',
    pending: 'bg-gray-100 text-gray-500',
    cancelled: 'bg-red-100 text-red-600',
};

const GROUP_OPTIONS = [
    { value: 'none', label: 'None (Flat)' },
    { value: 'size', label: 'Size' },
    { value: 'rating', label: 'Rating' },
    { value: 'size-rating', label: 'Size → Rating' },
    { value: 'workpack', label: 'Workpack' },
];

const FILTER_DEFS = [
    { key: 'blind_type', label: 'Type', options: ['spade', 'spacer', 'spectacle_blind', 'valve', 'other'] },
    { key: 'status', label: 'Status', options: ['pending', 'inserted', 'removed', 'verified', 'cancelled'] },
];

const COLUMNS = ['Blind No.', 'Workpack', 'Type', 'Size', 'Rating', 'Location', 'Status', 'Updated'];

// ── Component ────────────────────────────────────────────────────────────

export function CentralBlindRegister({ initialItems }: CentralBlindRegisterProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState<Record<string, string>>({ status: '', blind_type: '' });
    const [groupMode, setGroupMode] = useState<GroupMode>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('blind_register_grouping') as GroupMode) || 'size-rating';
        }
        return 'size-rating';
    });
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [defaultExpanded, setDefaultExpanded] = useState<boolean | null>(null);
    // SAP warning filter — when set, shows only items missing item_catalog_id
    const [filterMissingCatalog, setFilterMissingCatalog] = useState(false);

    // ── Filtering ──────────────────────────────────────────────────────
    const items = useMemo(() => {
        return initialItems.filter((item) => {
            const q = searchTerm.toLowerCase();
            const matchesSearch = !q ||
                (item.blind_number?.toLowerCase() || '').includes(q) ||
                (item.workpack?.workpack_id_code?.toLowerCase() || '').includes(q) ||
                (item.location?.toLowerCase() || '').includes(q);

            const matchesStatus = !filters.status || item.status === filters.status;
            const matchesType = !filters.blind_type || item.blind_type === filters.blind_type;
            const matchesCatalog = !filterMissingCatalog || !item.item_catalog_id;

            return matchesSearch && matchesStatus && matchesType && matchesCatalog;
        });
    }, [initialItems, searchTerm, filters, filterMissingCatalog]);

    // ── Summary stats ──────────────────────────────────────────────────
    const stats = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const item of initialItems) {
            counts[item.status] = (counts[item.status] ?? 0) + 1;
        }
        const missingCatalog = initialItems.filter((i) => !i.item_catalog_id).length;
        return { counts, missingCatalog };
    }, [initialItems]);

    // ── Grouping ───────────────────────────────────────────────────────
    const groupingKeys = useMemo(() => {
        switch (groupMode) {
            case 'size':       return ['flange_size'];
            case 'rating':     return ['rating'];
            case 'size-rating': return ['flange_size', 'rating'];
            case 'workpack':   return [(item: any) => item.workpack?.workpack_id_code || 'N/A'];
            default:           return [];
        }
    }, [groupMode]);

    const groupLabels = useMemo(() => {
        switch (groupMode) {
            case 'size':       return ['Size'];
            case 'rating':     return ['Rating'];
            case 'size-rating': return ['Size', 'Rating'];
            case 'workpack':   return ['Workpack'];
            default:           return [];
        }
    }, [groupMode]);

    const groupedData = useMemo(() => groupByHierarchy(items, groupingKeys as any), [items, groupingKeys]);

    // ── Group expand helpers ───────────────────────────────────────────
    const handleGroupModeChange = useCallback((mode: string) => {
        setGroupMode(mode as GroupMode);
        setExpandedGroups({});
        setDefaultExpanded(null);
        localStorage.setItem('blind_register_grouping', mode);
    }, []);

    const toggleGroup = useCallback((key: string) => {
        setExpandedGroups((prev) => ({
            ...prev,
            [key]: !(prev[key] ?? (defaultExpanded !== null ? defaultExpanded : key.split(':').length === 1)),
        }));
    }, [defaultExpanded]);

    const isGroupExpanded = (key: string, level: number) => {
        if (expandedGroups[key] !== undefined) return expandedGroups[key];
        if (defaultExpanded !== null) return defaultExpanded;
        return level === 0;
    };

    const handleExpandAll = useCallback(() => { setDefaultExpanded(true); setExpandedGroups({}); }, []);
    const handleCollapseAll = useCallback(() => { setDefaultExpanded(false); setExpandedGroups({}); }, []);

    // ── CSV Export ─────────────────────────────────────────────────────
    const exportCsv = useCallback(() => {
        const headers = ['Blind Number', 'Workpack', 'Type', 'Size', 'Rating', 'Location', 'Status', 'Inserted At', 'Removed At'].join(',');
        const rows = items.map((b) => [
            b.blind_number ?? '',
            b.workpack?.workpack_id_code ?? '',
            b.blind_type ?? '',
            b.flange_size ?? '',
            b.rating ?? '',
            `"${(b.location ?? '').replace(/"/g, '""')}"`,
            b.status ?? '',
            b.inserted_at ? new Date(b.inserted_at).toLocaleDateString('en-GB') : '',
            b.removed_at ? new Date(b.removed_at).toLocaleDateString('en-GB') : '',
        ].join(','));
        const blob = new Blob(['\xEF\xBB\xBF' + [headers, ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Blind_Register_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.csv`;
        a.click();
    }, [items]);

    // ── Row renderer ───────────────────────────────────────────────────
    const renderItemRow = (b: any, level: number) => (
        <tr key={b.id} className="hover:bg-blue-50/30 transition-colors border-b border-gray-100 last:border-0">
            <td className={`px-4 py-2.5 font-mono text-xs font-semibold text-gray-900 ${level === 1 ? 'pl-10' : level >= 2 ? 'pl-16' : 'pl-4'}`}>
                <div className="flex items-center gap-2">
                    {!b.item_catalog_id && (
                        <span title="No item catalog link" className="text-amber-500">⚠</span>
                    )}
                    {b.blind_number}
                </div>
            </td>
            <td className="px-4 py-2.5">
                <a href={`/workpacks/${b.workpack_id}`} className="text-blue-600 hover:underline font-mono text-xs font-medium">
                    {b.workpack?.workpack_id_code ?? '—'}
                </a>
            </td>
            <td className="px-4 py-2.5 text-gray-500 capitalize text-xs">{b.blind_type?.replace(/_/g, ' ')}</td>
            <td className="px-4 py-2.5 text-gray-800 font-medium text-xs tabular-nums">{b.flange_size ?? '—'}</td>
            <td className="px-4 py-2.5 text-gray-800 font-medium text-xs tabular-nums">{b.rating ?? '—'}</td>
            <td className="px-4 py-2.5 text-gray-500 max-w-xs truncate text-xs">{b.location ?? '—'}</td>
            <td className="px-4 py-2.5">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${STATUS_CLASSES[b.status ?? ''] ?? 'bg-gray-100 text-gray-500'}`}>
                    {b.status}
                </span>
            </td>
            <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap tabular-nums">
                {new Date(b.updated_at).toLocaleDateString('en-GB')}
            </td>
        </tr>
    );

    // ── Group row renderer (P6-style) ──────────────────────────────────
    const renderGroups = (data: any, level: number = 0, prefix: string = ''): React.ReactNode => {
        if (Array.isArray(data)) {
            return data.map((item) => renderItemRow(item, level));
        }

        const keys = sortNumericKeys(Object.keys(data));
        const label = groupLabels[level] || 'Group';

        return keys.map((key) => {
            const groupKey = `${prefix}${key}`;
            const expanded = isGroupExpanded(groupKey, level);
            const content = data[key];
            const count = getGroupCount(content);

            return (
                <Fragment key={groupKey}>
                    <tr
                        className={`cursor-pointer select-none transition-colors ${
                            level === 0
                                ? 'bg-[#0D2137]/5 hover:bg-[#0D2137]/10 border-b border-[#0D2137]/10'
                                : 'bg-gray-50 hover:bg-gray-100 border-b border-gray-100'
                        }`}
                        onClick={() => toggleGroup(groupKey)}
                    >
                        <td colSpan={COLUMNS.length} className={`py-2 pr-4 ${level === 0 ? 'pl-3' : 'pl-9'}`}>
                            <div className="flex items-center gap-2">
                                {/* Left accent border */}
                                <div className={`w-0.5 self-stretch rounded-full ${level === 0 ? 'bg-blue-500' : 'bg-gray-300'}`} />
                                {/* Toggle icon */}
                                {expanded
                                    ? <ChevronDown className={`${level === 0 ? 'text-blue-600' : 'text-gray-400'}`} size={14} />
                                    : <ChevronRight className={`${level === 0 ? 'text-blue-600' : 'text-gray-400'}`} size={14} />
                                }
                                {/* Label */}
                                <span className={`font-semibold ${level === 0 ? 'text-sm text-[#0D2137]' : 'text-xs text-gray-600'}`}>
                                    {label}:&nbsp;{key}
                                </span>
                                {/* Count chip */}
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
                                    level === 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                                }`}>
                                    {count}
                                </span>
                            </div>
                        </td>
                    </tr>
                    {expanded && renderGroups(content, level + 1, `${groupKey}:`)}
                </Fragment>
            );
        });
    };

    // ── Render ─────────────────────────────────────────────────────────
    return (
        <div className="px-6 py-5 w-full">
            {/* Page Header */}
            <div className="mb-5">
                <h1 className="text-xl font-bold text-gray-900">Consolidated Blind Register</h1>
                <p className="text-xs text-gray-500 mt-0.5">Isolations across all workpacks</p>
            </div>

            {/* Summary Bar */}
            <RegisterSummaryBar
                totalLabel="blinds"
                total={initialItems.length}
                filtered={items.length}
                stats={[
                    { label: 'Inserted', count: stats.counts['inserted'] ?? 0, color: 'orange' },
                    { label: 'Removed', count: stats.counts['removed'] ?? 0, color: 'blue' },
                    { label: 'Verified', count: stats.counts['verified'] ?? 0, color: 'green' },
                    { label: 'Pending', count: stats.counts['pending'] ?? 0, color: 'default' },
                    {
                        label: 'No Catalog Link',
                        count: stats.missingCatalog,
                        isWarning: true,
                        onClick: () => setFilterMissingCatalog((v) => !v),
                    },
                ]}
            />

            {/* Toolbar */}
            <RegisterToolbar
                groupMode={groupMode}
                groupOptions={GROUP_OPTIONS}
                onGroupModeChange={handleGroupModeChange}
                onExpandAll={handleExpandAll}
                onCollapseAll={handleCollapseAll}
                searchTerm={searchTerm}
                searchPlaceholder="Search by blind number, workpack code, or location…"
                onSearchChange={setSearchTerm}
                filters={filters}
                filterDefs={FILTER_DEFS}
                onFilterChange={(key, val) => setFilters((p) => ({ ...p, [key]: val }))}
                onExportCsv={exportCsv}
            />

            {/* Active filter chips */}
            {filterMissingCatalog && (
                <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 border border-amber-300 rounded-full text-[11px] font-semibold text-amber-800">
                        ⚠ No Catalog Link
                        <button
                            type="button"
                            onClick={() => setFilterMissingCatalog(false)}
                            className="ml-1 text-amber-600 hover:text-amber-900"
                        >×</button>
                    </span>
                </div>
            )}

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            {COLUMNS.map((h) => (
                                <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={COLUMNS.length} className="px-4 py-16 text-center text-gray-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <span className="text-3xl">📁</span>
                                        <p className="text-sm">No blinds found matching filters</p>
                                        {(searchTerm || Object.values(filters).some(Boolean) || filterMissingCatalog) && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSearchTerm('');
                                                    setFilters({ status: '', blind_type: '' });
                                                    setFilterMissingCatalog(false);
                                                }}
                                                className="text-xs text-blue-600 hover:underline"
                                            >
                                                Clear all filters
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            renderGroups(groupedData)
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
