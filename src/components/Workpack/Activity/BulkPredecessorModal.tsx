'use client';

import { useState } from 'react';

type RelationshipType = 'FS' | 'SS' | 'FF' | 'SF';

type ActivityOption = {
    id: string;
    activity_number: string | null;
    sequence_number: number | null;
    description: string;
    predecessors?: Array<{ predecessor_id: string; relationship_type: string; lag_days: number | null }>;
};

type BulkPredecessorModalProps = {
    workpackId: string;
    selectedIds: string[];
    activities: ActivityOption[];
    onSave: () => void;
    onClose: () => void;
};

type LinkEntry = {
    predecessorId: string;
    type: RelationshipType;
    lagHours: number;
};

type ActivityLinks = Record<string, LinkEntry[]>; // activityId → links

const REL_TYPES: RelationshipType[] = ['FS', 'SS', 'FF', 'SF'];
const REL_LABELS: Record<RelationshipType, string> = {
    FS: 'Finish→Start',
    SS: 'Start→Start',
    FF: 'Finish→Finish',
    SF: 'Start→Finish',
};

export function BulkPredecessorModal({
    workpackId,
    selectedIds,
    activities,
    onSave,
    onClose,
}: BulkPredecessorModalProps) {
    // Build initial state from existing predecessors
    const [links, setLinks] = useState<ActivityLinks>(() => {
        const initial: ActivityLinks = {};
        for (const id of selectedIds) {
            const act = activities.find((a) => a.id === id);
            initial[id] = (act?.predecessors ?? []).map((rel) => ({
                predecessorId: rel.predecessor_id,
                type: (rel.relationship_type ?? 'FS') as RelationshipType,
                lagHours: (rel.lag_days != null ? Number(rel.lag_days) : 0) * 8,
            }));
        }
        return initial;
    });

    const [search, setSearch] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const selectedActivities = selectedIds
        .map((id) => activities.find((a) => a.id === id))
        .filter(Boolean) as ActivityOption[];

    // Filtered candidate activities (not in selectedIds themselves)
    const candidates = activities.filter((a) => {
        if (selectedIds.includes(a.id)) return false;
        if (!search.trim()) return true;
        const s = search.toLowerCase();
        return (
            (a.activity_number ?? '').toLowerCase().includes(s) ||
            (a.description ?? '').toLowerCase().includes(s) ||
            String(a.sequence_number ?? '').includes(s)
        );
    });

    const isLinked = (activityId: string, predId: string) =>
        (links[activityId] ?? []).some((l) => l.predecessorId === predId);

    const toggleLink = (activityId: string, predId: string) => {
        setLinks((prev) => {
            const current = prev[activityId] ?? [];
            if (current.some((l) => l.predecessorId === predId)) {
                return { ...prev, [activityId]: current.filter((l) => l.predecessorId !== predId) };
            }
            return {
                ...prev,
                [activityId]: [...current, { predecessorId: predId, type: 'FS', lagHours: 0 }],
            };
        });
    };

    const updateLinkType = (activityId: string, predId: string, type: RelationshipType) => {
        setLinks((prev) => ({
            ...prev,
            [activityId]: (prev[activityId] ?? []).map((l) =>
                l.predecessorId === predId ? { ...l, type } : l
            ),
        }));
    };

    const updateLinkLag = (activityId: string, predId: string, lagHours: number) => {
        setLinks((prev) => ({
            ...prev,
            [activityId]: (prev[activityId] ?? []).map((l) =>
                l.predecessorId === predId ? { ...l, lagHours } : l
            ),
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            await Promise.all(
                selectedIds.map((activityId) =>
                    fetch(
                        `/api/workpacks/${workpackId}/activities/${activityId}/predecessors`,
                        {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ predecessors: links[activityId] ?? [] }),
                        }
                    ).then(async (res) => {
                        if (!res.ok) {
                            const d = await res.json().catch(() => ({}));
                            throw new Error(d.error ?? `Failed for activity ${activityId}`);
                        }
                    })
                )
            );
            onSave();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const totalLinks = selectedIds.reduce(
        (sum, id) => sum + (links[id]?.length ?? 0),
        0
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl flex flex-col"
                 style={{ width: '90vw', maxWidth: '900px', height: '80vh' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-none">
                    <div>
                        <h3 className="text-base font-semibold text-gray-900">
                            Link Predecessors
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {selectedActivities.length} activit{selectedActivities.length !== 1 ? 'ies' : 'y'} selected
                            {totalLinks > 0 && <span className="ml-2 text-blue-600 font-medium">{totalLinks} link{totalLinks !== 1 ? 's' : ''} set</span>}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
                </div>

                {/* Search bar */}
                <div className="px-6 py-3 border-b border-gray-100 flex-none bg-gray-50/50">
                    <input
                        type="text"
                        placeholder="Search activities to link as predecessor…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full px-4 py-2 text-sm border border-gray-200 rounded-lg
                                   focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                </div>

                {/* Body — split: left = selected activities, right = candidate list */}
                <div className="flex flex-1 min-h-0 overflow-hidden">

                    {/* Left: selected activity cards */}
                    <div className="w-56 flex-none border-r border-gray-100 overflow-y-auto bg-gray-50/30 p-3 space-y-2">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">
                            Assigning predecessors to:
                        </p>
                        {selectedActivities.map((act) => {
                            const linkCount = links[act.id]?.length ?? 0;
                            return (
                                <div key={act.id}
                                     className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm">
                                    <div className="font-mono text-xs font-bold text-gray-700">
                                        {act.activity_number ?? `#${act.sequence_number}`}
                                    </div>
                                    <div className="text-[11px] text-gray-500 truncate mt-0.5" title={act.description}>
                                        {act.description}
                                    </div>
                                    {linkCount > 0 && (
                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                            {(links[act.id] ?? []).map((l) => {
                                                const pred = activities.find((a) => a.id === l.predecessorId);
                                                return (
                                                    <span key={l.predecessorId}
                                                          className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5
                                                                     bg-blue-50 border border-blue-200 text-blue-700 rounded-full font-mono">
                                                        {pred?.activity_number ?? `#${pred?.sequence_number}`}
                                                        <span className="text-blue-400">{l.type}</span>
                                                        {l.lagHours !== 0 && (
                                                            <span className="text-blue-300">
                                                                {l.lagHours > 0 ? `+${l.lagHours}h` : `${l.lagHours}h`}
                                                            </span>
                                                        )}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Right: candidate activities to link */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {candidates.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <span className="text-3xl mb-2">🔍</span>
                                <p className="text-sm">No matching activities</p>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
                                    Click to link as predecessor → set type & lag
                                </p>
                                {candidates.map((cand) => {
                                    // Is this candidate linked to ALL selected activities?
                                    const linkedToAll = selectedIds.every((id) => isLinked(id, cand.id));
                                    const linkedToSome = selectedIds.some((id) => isLinked(id, cand.id));

                                    return (
                                        <div key={cand.id}
                                             className={`rounded-xl border transition-all ${
                                                 linkedToAll
                                                     ? 'border-blue-300 bg-blue-50'
                                                     : linkedToSome
                                                     ? 'border-blue-200 bg-blue-50/40'
                                                     : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50/50'
                                             }`}>

                                            {/* Candidate header row */}
                                            <div className="flex items-center gap-3 px-3 py-2.5">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        // Toggle this candidate for ALL selected activities at once
                                                        const willLink = !linkedToAll;
                                                        setLinks((prev) => {
                                                            const next = { ...prev };
                                                            for (const id of selectedIds) {
                                                                const current = next[id] ?? [];
                                                                if (willLink && !current.some((l) => l.predecessorId === cand.id)) {
                                                                    next[id] = [...current, { predecessorId: cand.id, type: 'FS', lagHours: 0 }];
                                                                } else if (!willLink) {
                                                                    next[id] = current.filter((l) => l.predecessorId !== cand.id);
                                                                }
                                                            }
                                                            return next;
                                                        });
                                                    }}
                                                    className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                                                        linkedToAll
                                                            ? 'bg-blue-600 border-blue-600 text-white'
                                                            : linkedToSome
                                                            ? 'bg-blue-200 border-blue-400'
                                                            : 'border-gray-300 hover:border-blue-400'
                                                    }`}
                                                    title={linkedToAll ? 'Unlink from all' : 'Link to all selected'}
                                                >
                                                    {linkedToAll && (
                                                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 10 10">
                                                            <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                        </svg>
                                                    )}
                                                    {linkedToSome && !linkedToAll && (
                                                        <span className="w-2 h-0.5 bg-blue-500 block" />
                                                    )}
                                                </button>

                                                <div className="flex-1 min-w-0">
                                                    <span className="font-mono text-xs font-bold text-gray-800">
                                                        {cand.activity_number ?? `#${cand.sequence_number}`}
                                                    </span>
                                                    <span className="ml-2 text-xs text-gray-500 truncate">
                                                        {cand.description}
                                                    </span>
                                                </div>

                                                {linkedToSome && (
                                                    <span className="text-[10px] text-blue-500 flex-shrink-0">
                                                        {selectedIds.filter((id) => isLinked(id, cand.id)).length}/{selectedIds.length} linked
                                                    </span>
                                                )}
                                            </div>

                                            {/* Per-activity type+lag controls when linked to at least one */}
                                            {linkedToSome && (
                                                <div className="px-3 pb-2.5 space-y-1.5 border-t border-blue-100/60 pt-2">
                                                    {selectedActivities.map((act) => {
                                                        const linked = isLinked(act.id, cand.id);
                                                        const link = (links[act.id] ?? []).find(
                                                            (l) => l.predecessorId === cand.id
                                                        );
                                                        return (
                                                            <div key={act.id}
                                                                 className="flex items-center gap-2 text-[11px]">
                                                                {/* Per-activity toggle */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleLink(act.id, cand.id)}
                                                                    className={`w-3.5 h-3.5 rounded border flex-shrink-0 ${
                                                                        linked
                                                                            ? 'bg-blue-500 border-blue-500'
                                                                            : 'border-gray-300'
                                                                    }`}
                                                                />
                                                                <span className="font-mono text-gray-600 w-24 truncate flex-shrink-0">
                                                                    {act.activity_number ?? `#${act.sequence_number}`}
                                                                </span>
                                                                {linked && link && (
                                                                    <>
                                                                        <select
                                                                            value={link.type}
                                                                            onChange={(e) =>
                                                                                updateLinkType(
                                                                                    act.id,
                                                                                    cand.id,
                                                                                    e.target.value as RelationshipType
                                                                                )
                                                                            }
                                                                            className="border border-gray-200 rounded px-1 py-0.5 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                                                                        >
                                                                            {REL_TYPES.map((t) => (
                                                                                <option key={t} value={t} title={REL_LABELS[t]}>
                                                                                    {t}
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                        <input
                                                                            type="number"
                                                                            value={link.lagHours}
                                                                            onChange={(e) =>
                                                                                updateLinkLag(
                                                                                    act.id,
                                                                                    cand.id,
                                                                                    Number(e.target.value) || 0
                                                                                )
                                                                            }
                                                                            className="w-16 border border-gray-200 rounded px-1 py-0.5 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                                                                            placeholder="lag h"
                                                                            step={1}
                                                                        />
                                                                        <span className="text-gray-400">h lag</span>
                                                                    </>
                                                                )}
                                                                {!linked && (
                                                                    <span className="text-gray-300 italic">not linked</span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 flex-none bg-gray-50/30">
                    <div className="text-xs text-gray-400">
                        Tip: Check the main checkbox to link a predecessor to <strong>all</strong> selected activities at once.
                        Use per-row checkboxes for individual control.
                    </div>
                    {error && <span className="text-xs text-red-500 mx-4">{error}</span>}
                    <div className="flex gap-2 flex-shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg
                                       hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center gap-2"
                        >
                            {saving && (
                                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            )}
                            {saving ? 'Saving…' : `Save ${totalLinks} Link${totalLinks !== 1 ? 's' : ''}`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
