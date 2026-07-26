'use client';

import { useState, useEffect, useCallback } from 'react';

type ChecklistItem = {
    id: string;
    sequence_number: number;
    description: string;
    responsible_party: string | null;
    is_done: boolean;
    signed_at: string | null;
    notes: string | null;
};

type Checklist = {
    id: string;
    checklist_type: string;
    created_at: string;
    items: ChecklistItem[];
};

interface BoxUpChecklistTabProps {
    workpackId: string;
    readOnly?: boolean;
    onCompletionChange?: (complete: boolean) => void;
}

export function BoxUpChecklistTab({ workpackId, readOnly = false, onCompletionChange }: BoxUpChecklistTabProps) {
    const [checklist, setChecklist] = useState<Checklist | null>(null);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newItem, setNewItem] = useState('');
    const [newResponsible, setNewResponsible] = useState('');
    const [addingItems, setAddingItems] = useState(false);
    const [error, setError] = useState('');
    const [savingItem, setSavingItem] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/workpacks/${workpackId}/checklists/box-up`);
            if (res.ok) {
                const data: Checklist | null = await res.json();
                setChecklist(data);
                if (data) {
                    const allSigned = data.items.length > 0 && data.items.every((i) => i.is_done);
                    onCompletionChange?.(allSigned);
                }
            }
        } finally {
            setLoading(false);
        }
    }, [workpackId, onCompletionChange]);

    useEffect(() => { load(); }, [load]);

    const createChecklist = async () => {
        setCreating(true);
        setError('');
        try {
            const res = await fetch(`/api/workpacks/${workpackId}/checklists/box-up`, { method: 'POST' });
            if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed');
        } finally {
            setCreating(false);
        }
    };

    const addItem = async () => {
        if (!newItem.trim() || !checklist) return;
        setAddingItems(true);
        try {
            await fetch(`/api/workpacks/${workpackId}/checklists/box-up/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: [{ description: newItem.trim(), responsible_party: newResponsible.trim() || undefined }],
                }),
            });
            setNewItem('');
            setNewResponsible('');
            await load();
        } finally {
            setAddingItems(false);
        }
    };

    const toggleSignOff = async (item: ChecklistItem) => {
        if (readOnly) return;
        setSavingItem(item.id);
        try {
            await fetch(`/api/workpacks/${workpackId}/checklists/box-up/items/${item.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    is_done: !item.is_done,
                    signed_at: !item.is_done ? new Date().toISOString() : null,
                }),
            });
            await load();
        } finally {
            setSavingItem(null);
        }
    };

    if (loading) return <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>;

    if (!checklist) {
        return (
            <div className="flex flex-col items-center justify-center h-56 gap-4">
                <div className="text-5xl">🔒</div>
                <p className="text-gray-500 text-sm text-center max-w-xs">
                    No box-up checklist created yet. All mandatory items must be signed off before the workpack can advance to mechanical complete.
                </p>
                {!readOnly && (
                    <button
                        id="create-boxup-checklist-btn"
                        onClick={createChecklist}
                        disabled={creating}
                        className="px-5 py-2.5 bg-[#0D2137] text-white text-sm font-medium rounded-xl hover:bg-[#1a3a5c] disabled:opacity-50"
                    >
                        {creating ? 'Creating…' : '+ Create Box-up Checklist'}
                    </button>
                )}
                {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
        );
    }

    const signedCount = checklist.items.filter((i) => i.is_done).length;
    const allComplete = checklist.items.length > 0 && signedCount === checklist.items.length;

    return (
        <div className="flex flex-col gap-4">
            {/* Completion gate banner */}
            <div className={`flex items-center gap-3 p-3 rounded-xl border text-sm font-medium ${
                allComplete
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
                <span className="text-lg">{allComplete ? '✅' : '🔒'}</span>
                {allComplete
                    ? 'All items signed off — workpack ready for mechanical complete'
                    : `Completion gate: ${signedCount}/${checklist.items.length} items signed off`}
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden">
                {checklist.items.length === 0 ? (
                    <div className="flex items-center justify-center h-24 text-sm text-gray-400">No items yet</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <th className="px-4 py-3 text-center w-12">Done</th>
                                <th className="px-4 py-3 text-left">#</th>
                                <th className="px-4 py-3 text-left">Description</th>
                                <th className="px-4 py-3 text-left">Responsible</th>
                                <th className="px-4 py-3 text-left">Signed At</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {checklist.items.map((item) => (
                                <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${item.is_done ? 'bg-green-50/30' : ''}`}>
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            id={`boxup-sign-off-${item.id}`}
                                            onClick={() => toggleSignOff(item)}
                                            disabled={readOnly || savingItem === item.id}
                                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all mx-auto ${
                                                item.is_done
                                                    ? 'bg-green-500 border-green-500 text-white'
                                                    : 'border-gray-300 hover:border-green-400'
                                            } disabled:opacity-40`}
                                        >
                                            {item.is_done && <span className="text-xs">✓</span>}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{item.sequence_number}</td>
                                    <td className={`px-4 py-3 font-medium ${item.is_done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                        {item.description}
                                    </td>
                                    <td className="px-4 py-3 text-gray-500">{item.responsible_party ?? '—'}</td>
                                    <td className="px-4 py-3 text-gray-400 text-xs">
                                        {item.signed_at ? new Date(item.signed_at).toLocaleString() : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {!readOnly && (
                <div className="flex gap-2 items-end">
                    <div className="flex-1">
                        <input
                            id="new-boxup-item-desc"
                            type="text"
                            placeholder="Add box-up checklist item…"
                            value={newItem}
                            onChange={(e) => setNewItem(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && void addItem()}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D2137] outline-none"
                        />
                    </div>
                    <div>
                        <input
                            type="text"
                            placeholder="Responsible party"
                            value={newResponsible}
                            onChange={(e) => setNewResponsible(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-44 outline-none border focus:ring-2 focus:ring-[#0D2137]"
                        />
                    </div>
                    <button
                        onClick={() => void addItem()}
                        disabled={!newItem.trim() || addingItems}
                        className="px-4 py-2 bg-[#0D2137] text-white text-sm font-medium rounded-lg hover:bg-[#1a3a5c] disabled:opacity-40"
                    >
                        {addingItems ? '…' : '+ Add'}
                    </button>
                </div>
            )}
        </div>
    );
}
