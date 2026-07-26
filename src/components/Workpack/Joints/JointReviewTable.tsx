'use client';

import { useState, useCallback } from 'react';
import type { ExtractedJoint } from '@/lib/ai/jointExtraction';

interface JointReviewTableProps {
    open: boolean;
    onClose: () => void;
    joints: ExtractedJoint[];
    existingJointNumbers: Set<string>;
    workpackId: string;
    sourceLabel?: string;
    onSaved: () => void;
}

type EditableJoint = ExtractedJoint & { _selected?: boolean };

export function JointReviewTable({
    open,
    onClose,
    joints: initialJoints,
    existingJointNumbers,
    workpackId,
    sourceLabel = 'AI generated',
    onSaved,
}: JointReviewTableProps) {
    const [rows, setRows] = useState<EditableJoint[]>(() =>
        initialJoints.map((j) => ({ ...j, _selected: true }))
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const updateRow = useCallback((index: number, field: keyof ExtractedJoint, value: string | number | null) => {
        setRows((prev) => {
            const next = [...prev];
            const r = { ...next[index]! };
            (r as Record<string, unknown>)[field] = value;
            next[index] = r;
            return next;
        });
    }, []);

    const toggleRow = useCallback((index: number) => {
        setRows((prev) => {
            const next = [...prev];
            next[index] = { ...next[index]!, _selected: !next[index]!._selected };
            return next;
        });
    }, []);

    const toggleAll = useCallback((checked: boolean) => {
        setRows((prev) => prev.map((r) => ({ ...r, _selected: checked })));
    }, []);

    const handleSave = async () => {
        const toSave = rows.filter((r) => r._selected !== false).map(({ _selected, ...j }) => j);
        if (toSave.length === 0) {
            setError('Select at least one joint to add.');
            return;
        }
        setError('');
        setSaving(true);
        try {
            const res = await fetch(`/api/workpacks/${workpackId}/joints/bulk-create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ joints: toSave, skipDuplicates: true }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `Request failed (${res.status})`);
            }
            onSaved();
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    const selectedCount = rows.filter((r) => r._selected).length;
    const allSelected = rows.length > 0 && rows.every((r) => r._selected);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
            <div className="relative bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Review Extracted Joints ({rows.length} found)</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Source: {sourceLabel}</p>
                    </div>
                    <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">✕</button>
                </div>
                <div className="overflow-auto flex-1 p-4">
                    <p className="text-xs text-gray-500 mb-2">All rows are editable inline before saving. Uncheck rows you don&apos;t want to import.</p>
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                                <th className="py-2 pr-2 text-left font-medium w-10">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={(e) => toggleAll(e.target.checked)}
                                        className="rounded"
                                    />
                                </th>
                                <th className="py-2 pr-2 text-left font-medium" style={{ minWidth: 120 }}>Joint No.</th>
                                <th className="py-2 pr-2 text-left font-medium" style={{ minWidth: 180 }}>Location</th>
                                <th className="py-2 pr-2 text-left font-medium" style={{ minWidth: 70 }}>Size</th>
                                <th className="py-2 pr-2 text-left font-medium" style={{ minWidth: 100 }}>Rating</th>
                                <th className="py-2 pr-2 text-left font-medium" style={{ minWidth: 130 }}>Gasket</th>
                                <th className="py-2 pr-2 text-left font-medium" style={{ minWidth: 100 }}>Line No.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, i) => {
                                const isDuplicate = existingJointNumbers.has((row.jointNo ?? '').trim());
                                return (
                                    <tr
                                        key={i}
                                        className={`border-b border-gray-100 ${isDuplicate ? 'bg-amber-50' : ''} ${row._selected === false ? 'opacity-60' : ''}`}
                                    >
                                        <td className="py-1.5 pr-2">
                                            <input
                                                type="checkbox"
                                                checked={row._selected !== false}
                                                onChange={() => toggleRow(i)}
                                                className="rounded"
                                            />
                                        </td>
                                        <td className="py-1.5 pr-2">
                                            {isDuplicate && (
                                                <span className="text-amber-600 text-xs block">Already exists — skip or replace</span>
                                            )}
                                            <input
                                                value={row.jointNo ?? ''}
                                                onChange={(e) => updateRow(i, 'jointNo', e.target.value)}
                                                className="w-full px-2 py-1 border border-gray-200 rounded text-xs font-mono"
                                            />
                                        </td>
                                        <td className="py-1.5 pr-2">
                                            <input
                                                value={row.location ?? ''}
                                                onChange={(e) => updateRow(i, 'location', e.target.value)}
                                                className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                                            />
                                        </td>
                                        <td className="py-1.5 pr-2">
                                            <input
                                                value={row.size ?? ''}
                                                onChange={(e) => updateRow(i, 'size', e.target.value)}
                                                className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                                            />
                                        </td>
                                        <td className="py-1.5 pr-2">
                                            <input
                                                value={row.flangeRating ?? ''}
                                                onChange={(e) => updateRow(i, 'flangeRating', e.target.value)}
                                                className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                                            />
                                        </td>
                                        <td className="py-1.5 pr-2">
                                            <input
                                                value={row.gasketMaterial ?? row.gasketType ?? ''}
                                                onChange={(e) => updateRow(i, 'gasketMaterial', e.target.value)}
                                                className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                                                placeholder="Gasket type / material"
                                            />
                                        </td>
                                        <td className="py-1.5 pr-2">
                                            <input
                                                value={row.lineNumber ?? ''}
                                                onChange={(e) => updateRow(i, 'lineNumber', e.target.value)}
                                                className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {error && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
                    )}
                </div>
                <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 flex-shrink-0">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || selectedCount === 0}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {saving ? 'Saving…' : `✓ Add ${selectedCount} Joints to Register`}
                    </button>
                </div>
            </div>
        </div>
    );
}
