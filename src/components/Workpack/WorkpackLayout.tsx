'use client';

import { useState, useEffect } from 'react';
import type React from 'react';

export const WORKPACK_TABS = [
    {
        id: 'overview',
        label: 'Overview',
        icon: '📋',
        feature: null,
    },
    {
        id: 'activities',
        label: 'Activities',
        icon: '📝',
        feature: 'wp.tab.activities',
    },
    {
        id: 'joints_blinds',
        label: 'Joints & Blinds',
        icon: '🔩',
        feature: 'wp.tab.joints',
    },
    {
        id: 'materials',
        label: 'Materials',
        icon: '📦',
        feature: 'wp.tab.materials',
    },
    {
        id: 'tools',
        label: 'Tools',
        icon: '🛠',
        feature: 'wp.tab.tools',
    },
    {
        id: 'constraints',
        label: 'Constraints',
        icon: '⚠️',
        feature: 'wp.tab.constraints',
    },
    {
        id: 'preparation',
        label: 'Preparation',
        icon: '🔧',
        feature: 'wp.tab.checklists',
    },
    {
        id: 'cleaning',
        label: 'Cleaning',
        icon: '🧹',
        feature: 'wp.tab.cleaning',
    },
    {
        id: 'qa_clearance',
        label: 'QA & Clearance',
        icon: '✅',
        feature: 'wp.tab.qa',
    },
    {
        id: 'certificates',
        label: 'Certificates',
        icon: '📜',
        feature: 'wp.tab.certificates',
    },
    {
        id: 'attachments',
        label: 'Attachments',
        icon: '📎',
        feature: null,
    },
    {
        id: 'documents',
        label: 'Documents',
        icon: '📁',
        feature: null,
    },
    {
        id: 'lessons',
        label: 'Lessons Learned',
        icon: '💡',
        feature: 'wp.tab.lessons_learnt',
    },
    {
        id: 'punch_list',
        label: 'Punch List',
        icon: '📌',
        feature: 'wp.tab.punch_list',
        hidden: true,
    },
] as const;

export type WorkpackTabId = (typeof WORKPACK_TABS)[number]['id'];

const STATUS_STYLES: Record<
    string,
    { bg: string; text: string; label: string }
> = {
    draft: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Draft' },
    under_review: {
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        label: 'Under Review',
    },
    ready_for_review: {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        label: 'For Review',
    },
    submitted: {
        bg: 'bg-indigo-100',
        text: 'text-indigo-700',
        label: 'Submitted',
    },
    approved: {
        bg: 'bg-green-100',
        text: 'text-green-700',
        label: 'Approved',
    },
    revision_required: {
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        label: 'Revision',
    },
    issued: {
        bg: 'bg-purple-100',
        text: 'text-purple-700',
        label: 'Issued',
    },
    in_execution: {
        bg: 'bg-orange-100',
        text: 'text-orange-800',
        label: 'In Execution',
    },
    in_progress: {
        bg: 'bg-blue-200',
        text: 'text-blue-800',
        label: 'In Progress',
    },
    on_hold: {
        bg: 'bg-amber-200',
        text: 'text-amber-800',
        label: 'On Hold',
    },
    completed: {
        bg: 'bg-teal-100',
        text: 'text-teal-800',
        label: 'Completed',
    },
    complete: {
        bg: 'bg-green-200',
        text: 'text-green-800',
        label: 'Complete',
    },
    closed: {
        bg: 'bg-green-200',
        text: 'text-green-800',
        label: 'Closed',
    },
    cancelled: {
        bg: 'bg-red-100',
        text: 'text-red-600',
        label: 'Cancelled',
    },
};

interface WorkpackLayoutProps {
    workpack: any;
    activeTab: WorkpackTabId;
    features: Set<string>;
    canEdit: boolean;
    children: React.ReactNode;
    onTabChange: (tab: WorkpackTabId) => void;
    counts?: {
        open_constraints?: number;
        open_hold_points?: number;
        pending_certs?: number;
        ai_generated_joints?: number;
        ai_generated_materials?: number;
        ai_generated_tools?: number;
        ai_generated_constraints?: number;
    };
    canDelete?: boolean;
    onDeleteClick?: () => void;
}

export function WorkpackLayout({
    workpack,
    activeTab,
    features,
    canEdit, // reserved for future use
    children,
    onTabChange,
    counts = {},
    canDelete = false,
    onDeleteClick,
}: WorkpackLayoutProps) {
    const [auditOpen, setAuditOpen] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
    const [showRegenMenu, setShowRegenMenu] = useState(false);

    const handleRegenerate = (action: string) => {
        setShowRegenMenu(false);
        if (action === 'joints' || action === 'all') {
            window.dispatchEvent(new CustomEvent('trigger-regen-joints'));
        }
        if (action === 'materials' || action === 'all') {
            window.dispatchEvent(new CustomEvent('trigger-regen-materials'));
        }
        if (action === 'constraints' || action === 'all') {
            window.dispatchEvent(new CustomEvent('trigger-regen-constraints'));
        }
    };

    const visibleTabs = WORKPACK_TABS.filter(
        (t: any) => !t.hidden && (!t.feature || features.has(t.feature))
    );

    const statusStyle =
        STATUS_STYLES[workpack.status] ?? STATUS_STYLES.draft;

    const tabBadge: Record<string, number | undefined> = {
        constraints: counts.open_constraints,
        qa_clearance: counts.open_hold_points,
        certificates: counts.pending_certs,
    };
    const aiBadgeTab: Record<string, number | undefined> = {
        joints_blinds: counts.ai_generated_joints,
        materials: counts.ai_generated_materials,
        tools: counts.ai_generated_tools,
        constraints: counts.ai_generated_constraints,
    };

    function handleExport(format: string) {
        setExportOpen(false);
        if (format === 'primavera') {
            const toast = document.createElement('div');
            toast.className =
                'fixed bottom-6 right-6 z-50 bg-amber-600 text-white text-sm px-5 py-3 rounded-xl shadow-xl';
            toast.textContent =
                '⏳ Primavera P6 export is coming in Phase 4';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 4000);
            return;
        }
        if (format === 'pdf') {
            const docCount = (workpack as { workpack_documents?: unknown[] }).workpack_documents?.length ?? 0;
            const estimatedSeconds = Math.min(120, 10 + docCount * 3);
            const toast = document.createElement('div');
            toast.className =
                'fixed bottom-6 right-6 z-50 bg-[#0D2137] text-white text-sm px-5 py-3 rounded-xl shadow-xl max-w-sm';
            toast.textContent =
                docCount > 0
                    ? `Generating PDF with ${docCount} attachment${docCount !== 1 ? 's' : ''}… (~${estimatedSeconds}s)`
                    : 'Generating PDF…';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), Math.min(estimatedSeconds * 1000, 15000));
            const url = `/api/workpacks/${workpack.id}/pdf`;
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.click();
            return;
        }
        if (format === 'pdf_only') {
            const url = `/api/workpacks/${workpack.id}/pdf?attachments=false`;
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.click();
            return;
        }
        const urls: Record<string, string> = {
            msproject: `/api/workpacks/${workpack.id}/export/ms-project`,
            primavera: `/api/workpacks/${workpack.id}/export/primavera`,
            csv: `/api/workpacks/${workpack.id}/export/activities-csv`,
            excel: `/api/workpacks/${workpack.id}/export/activities-excel`,
            sap_csv: `/api/workpacks/${workpack.id}/materials/export?format=sap_csv`,
        };
        const url = urls[format];
        if (url) {
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.click();
        }
    }

    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Fixed header below 56px dashboard nav */}
            <div className="flex-none bg-white border-b border-gray-200 px-5 py-2.5 flex items-center justify-between gap-4 shadow-sm min-w-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    {workpack.workpack_id_code ? (
                        <span className="flex-none font-mono text-base font-bold text-white bg-[#0D2137] px-3 py-1.5 rounded-lg tracking-wider whitespace-nowrap">
                            {workpack.workpack_id_code}
                        </span>
                    ) : (
                        <span className="flex-none text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg whitespace-nowrap">
                            No ID
                        </span>
                    )}
                    <div className="min-w-0">
                        <h1 className="text-sm font-semibold text-gray-900 truncate leading-tight">
                            {workpack.title}
                        </h1>
                        {(workpack.asset_name ||
                            workpack.asset_tag ||
                            workpack.site?.name) && (
                            <p className="text-xs text-gray-400 truncate leading-tight mt-0.5">
                                {[
                                    workpack.asset_name,
                                    workpack.asset_tag,
                                    workpack.site?.name,
                                ]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </p>
                        )}
                    </div>
                    <span
                        className={`flex-none text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${statusStyle.bg} ${statusStyle.text}`}
                    >
                        {statusStyle.label}
                    </span>
                </div>
                <div className="flex-none flex items-center gap-2">
                    <div className="relative">
                        <button
                            onClick={() => setExportOpen((o) => !o)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                        >
                            ⬇ Export
                            <span className="text-gray-400 text-xs">▾</span>
                        </button>
                        {exportOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setExportOpen(false)}
                                />
                                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 py-1.5 min-w-[200px]">
                                    {[
                                        {
                                            format: 'pdf',
                                            icon: '📄',
                                            label: 'Download Full PDF (with attachments)',
                                        },
                                        {
                                            format: 'pdf_only',
                                            icon: '📄',
                                            label: 'Download Workpack Only (no attachments)',
                                        },
                                        {
                                            format: 'msproject',
                                            icon: '📊',
                                            label: 'MS Project XML',
                                        },
                                        {
                                            format: 'primavera',
                                            icon: '📐',
                                            label: 'Primavera P6',
                                        },
                                        {
                                            format: 'csv',
                                            icon: '📋',
                                            label: 'Activities CSV',
                                        },
                                        {
                                            format: 'excel',
                                            icon: '📊',
                                            label: 'Activities Excel',
                                        },
                                        {
                                            format: 'sap_csv',
                                            icon: '🏭',
                                            label: 'SAP Materials CSV',
                                        },
                                    ].map((e) => (
                                        <button
                                            key={e.format}
                                            onClick={() =>
                                                handleExport(e.format)
                                            }
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5"
                                        >
                                            <span>{e.icon}</span>
                                            {e.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setShowRegenMenu((v) => !v)}
                            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1"
                        >
                            ↻ Regenerate
                            <span className="text-gray-400">▾</span>
                        </button>
                        {showRegenMenu && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowRegenMenu(false)} />
                                <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden w-52">
                                    {[
                                        { label: '↻ Joint Register', action: 'joints' },
                                        { label: '↻ Materials List', action: 'materials' },
                                        { label: '↻ Constraints', action: 'constraints' },
                                        { label: '↻ All AI Sections', action: 'all' },
                                    ].map((item) => (
                                        <button
                                            key={item.action}
                                            type="button"
                                            onClick={() => handleRegenerate(item.action)}
                                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors border-b border-gray-50 last:border-0"
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                    {canDelete && onDeleteClick && (
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setHeaderMenuOpen((o) => !o)}
                                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-700"
                                aria-label="More actions"
                            >
                                ⋮
                            </button>
                            {headerMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setHeaderMenuOpen(false)} />
                                    <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setHeaderMenuOpen(false);
                                                onDeleteClick();
                                            }}
                                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium"
                                        >
                                            Delete Workpack
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    <button
                        onClick={() => setAuditOpen(true)}
                        title="Audit Log — view all changes"
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 text-lg leading-none"
                    >
                        🕐
                    </button>
                </div>
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden">
                <nav className="flex-none w-44 bg-[#0D2137] flex flex-col overflow-y-auto overflow-x-hidden border-r border-[#162d47] scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20">
                    <div className="flex-1 py-2">
                        {visibleTabs.map((tab: any) => {
                            const isActive = activeTab === tab.id;
                            const badgeCount = tabBadge[tab.id];
                            const aiCount = aiBadgeTab[tab.id];
                            const showAiBadge = aiCount != null && aiCount > 0;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        onTabChange(tab.id as WorkpackTabId);
                                        if (typeof window !== 'undefined') {
                                            window.history.replaceState(
                                                null,
                                                '',
                                                `#${tab.id}`,
                                            );
                                        }
                                    }}
                                    className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors duration-100 relative group ${
                                        isActive
                                            ? 'bg-white/15 text-white font-medium'
                                            : 'text-gray-400 hover:bg-white/8 hover:text-gray-200'
                                    }`}
                                >
                                    {isActive && (
                                        <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-blue-400 rounded-r-full" />
                                    )}
                                    <span className="text-base leading-none flex-none">
                                        {tab.icon}
                                    </span>
                                    <span className="text-xs leading-tight flex-1 truncate">
                                        {tab.label}
                                    </span>
                                    {showAiBadge && (
                                        <span className="flex-none text-[10px] bg-violet-500/90 text-white px-1 py-0.5 rounded font-medium">
                                            AI
                                        </span>
                                    )}
                                    {badgeCount != null && badgeCount > 0 && (
                                        <span className="flex-none text-xs bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center leading-none font-bold">
                                            {badgeCount > 9 ? '9+' : badgeCount}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex-none px-3 pb-3 pt-2 border-t border-white/10">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs text-gray-500">
                                Progress
                            </span>
                            <span className="text-xs text-gray-400 font-medium">
                                {workpack.overall_progress ?? 0}%
                            </span>
                        </div>
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-400 rounded-full transition-all duration-500"
                                style={{
                                    width: `${
                                        workpack.overall_progress ?? 0
                                    }%`,
                                }}
                            />
                        </div>
                    </div>
                </nav>

                <main className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-50">
                    <div className="p-5 min-h-full">{children}</div>
                </main>
            </div>

            {auditOpen && (
                <AuditDrawer
                    workpackId={workpack.id}
                    onClose={() => setAuditOpen(false)}
                />
            )}
        </div>
    );
}

function AuditDrawer({
    workpackId,
    onClose,
}: {
    workpackId: string;
    onClose: () => void;
}) {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        fetch(`/api/workpacks/${workpackId}/audit?limit=50`)
            .then((r) => (r.ok ? r.json() : { logs: [] }))
            .then((d) => {
                if (cancelled) return;
                setLogs(d.logs ?? d ?? []);
                setLoading(false);
            })
            .catch(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [workpackId]);

    return (
        <>
            <div
                className="fixed inset-0 bg-black/30 z-30"
                onClick={onClose}
            />
            <div className="fixed right-0 top-0 bottom-0 w-96 bg-white shadow-2xl z-40 flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                    <h2 className="text-sm font-semibold text-gray-900">
                        🕐 Audit Log
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-xl leading-none p-1"
                    >
                        ✕
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                            Loading...
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 text-sm">
                            No audit events recorded yet.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {logs.map((log: any, idx: number) => (
                                <div
                                    key={log.id ?? idx}
                                    className="text-xs border-b border-gray-100 pb-3 last:border-0"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="font-medium text-gray-800">
                                            {log.user_email ??
                                                log.performed_by ??
                                                'System'}
                                        </span>
                                        <span className="text-gray-400 whitespace-nowrap">
                                            {log.created_at
                                                ? new Date(
                                                      log.created_at,
                                                  ).toLocaleString('en-GB', {
                                                      day: '2-digit',
                                                      month: 'short',
                                                      hour: '2-digit',
                                                      minute: '2-digit',
                                                  })
                                                : ''}
                                        </span>
                                    </div>
                                    <div className="text-gray-600 mt-0.5">
                                        {log.action ??
                                            log.description ??
                                            '—'}
                                    </div>
                                    {log.field_name && (
                                        <div className="mt-1 text-gray-400">
                                            <span className="font-medium">
                                                {log.field_name}:
                                            </span>{' '}
                                            <span className="line-through text-red-400">
                                                {String(
                                                    log.old_value ?? '—',
                                                )}
                                            </span>{' '}
                                            {'→ '}{' '}
                                            <span className="text-green-600">
                                                {String(
                                                    log.new_value ?? '—',
                                                )}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex-none px-5 py-3 border-t border-gray-200">
                    <a
                        href={`/workpacks/${workpackId}/audit`}
                        target="_blank"
                        className="text-xs text-blue-600 hover:underline"
                    >
                        View full audit log →
                    </a>
                </div>
            </div>
        </>
    );
}

