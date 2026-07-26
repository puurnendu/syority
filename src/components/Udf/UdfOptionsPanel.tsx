'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export type UdfOption = {
    id: string;
    code_value?: string | null;
    value: string;
    label: string;
    description?: string | null;
    sort_order?: number | null;
    is_active?: boolean | null;
};

type Row = {
    _key: string;       // local unique key (id or temp)
    id?: string;        // undefined = new row
    code_value: string;
    label: string;
    is_active: boolean;
    _dirty?: boolean;
};

type Props = {
    definitionId: string;
    definitionName: string;
    options: UdfOption[];
    onSaved: () => void;
    onCancel: () => void;
};

let _keyCounter = 0;
const newKey = () => `new_${++_keyCounter}`;

function rowsFromOptions(opts: UdfOption[]): Row[] {
    return opts.map((o) => ({
        _key: o.id,
        id: o.id,
        code_value: o.code_value ?? o.value ?? '',
        label: o.label ?? o.description ?? '',
        is_active: o.is_active !== false,
    }));
}

export function UdfOptionsPanel({
    definitionId,
    definitionName,
    options: initialOptions,
    onSaved,
    onCancel,
}: Props) {
    const [rows, setRows] = useState<Row[]>(() => rowsFromOptions(initialOptions));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showPaste, setShowPaste] = useState(false);
    const [pasteText, setPasteText] = useState('');
    const [pastePreview, setPastePreview] = useState<{ code: string; label: string }[]>([]);
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
    const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    useEffect(() => {
        setRows(rowsFromOptions(initialOptions));
        setError('');
        setShowPaste(false);
        setPasteText('');
        setPastePreview([]);
    }, [definitionId, initialOptions]);

    // ── Grid cell focus helper ──────────────────────────
    const focusCell = useCallback((key: string, field: 'code' | 'label') => {
        const ref = inputRefs.current[`${key}_${field}`];
        if (ref) { ref.focus(); ref.select(); }
    }, []);

    // ── Add blank row ───────────────────────────────────
    const addRow = useCallback((afterKey?: string) => {
        const key = newKey();
        setRows((prev) => {
            if (!afterKey) return [...prev, { _key: key, code_value: '', label: '', is_active: true }];
            const idx = prev.findIndex((r) => r._key === afterKey);
            const next = [...prev];
            next.splice(idx + 1, 0, { _key: key, code_value: '', label: '', is_active: true });
            return next;
        });
        // Focus the new code cell after render
        setTimeout(() => focusCell(key, 'code'), 30);
    }, [focusCell]);

    // ── Cell change ─────────────────────────────────────
    const updateRow = (key: string, field: 'code_value' | 'label' | 'is_active', value: string | boolean) => {
        setRows((prev) => prev.map((r) => r._key === key ? { ...r, [field]: value, _dirty: true } : r));
    };

    // ── Remove row ──────────────────────────────────────
    const removeRow = (key: string) => {
        setRows((prev) => prev.filter((r) => r._key !== key));
    };

    // ── Keyboard navigation ─────────────────────────────
    const handleKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement>,
        key: string,
        field: 'code' | 'label',
        rowIdx: number
    ) => {
        if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            if (field === 'code') {
                focusCell(key, 'label');
            } else {
                // label → move to next row code, or add row if last
                const isLast = rowIdx === rows.length - 1;
                if (isLast) {
                    addRow(key);
                } else {
                    focusCell(rows[rowIdx + 1]._key, 'code');
                }
            }
        } else if (e.key === 'Tab' && e.shiftKey) {
            e.preventDefault();
            if (field === 'label') {
                focusCell(key, 'code');
            } else if (rowIdx > 0) {
                focusCell(rows[rowIdx - 1]._key, 'label');
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            addRow(key);
        } else if (e.key === 'Escape') {
            (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Delete' && e.ctrlKey) {
            e.preventDefault();
            removeRow(key);
        }
    };

    // ── Paste from Excel parser ─────────────────────────
    const parsePaste = (text: string) => {
        const lines = text.trim().split('\n').filter((l) => l.trim());
        const parsed = lines.map((line) => {
            const parts = line.split(/\t|,/).map((s) => s.trim().replace(/^"|"$/g, ''));
            const code = (parts[0] ?? '').toUpperCase().replace(/\s+/g, '_');
            const label = parts[1] ?? parts[0] ?? '';
            return { code, label };
        }).filter((r) => r.code);
        setPastePreview(parsed);
    };

    const applyPaste = () => {
        const newRows: Row[] = pastePreview.map((p) => ({
            _key: newKey(),
            code_value: p.code,
            label: p.label || p.code,
            is_active: true,
        }));
        // Merge: skip duplicates by code_value
        setRows((prev) => {
            const existingCodes = new Set(prev.map((r) => r.code_value.toUpperCase()));
            const toAdd = newRows.filter((r) => !existingCodes.has(r.code_value.toUpperCase()));
            return [...prev, ...toAdd];
        });
        setShowPaste(false);
        setPasteText('');
        setPastePreview([]);
    };

    // ── Drag to reorder ─────────────────────────────────
    const handleDragStart = (idx: number) => setDragIdx(idx);
    const handleDragOver = (e: React.DragEvent, idx: number) => {
        e.preventDefault();
        setDragOverIdx(idx);
    };
    const handleDrop = (idx: number) => {
        if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
        setRows((prev) => {
            const next = [...prev];
            const [moved] = next.splice(dragIdx, 1);
            next.splice(idx, 0, moved);
            return next;
        });
        setDragIdx(null);
        setDragOverIdx(null);
    };

    // ── Save ────────────────────────────────────────────
    const handleSave = async () => {
        setError('');
        setSaving(true);
        try {
            const payload = rows
                .filter((r) => r.code_value.trim())
                .map((r, i) => ({
                    ...(r.id ? { id: r.id } : {}),
                    code_value: r.code_value.trim().toUpperCase().replace(/\s+/g, '_'),
                    label: r.label.trim() || r.code_value.trim(),
                    description: r.label.trim() || null,
                    sort_order: i,
                    is_active: r.is_active,
                }));
            const res = await fetch(
                `/api/master-data/udf-definitions/${definitionId}/options`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ options: payload }),
                }
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || 'Save failed');
            onSaved();
        } catch (err: any) {
            setError(err.message ?? 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const activeCount = rows.filter((r) => r.is_active && r.code_value.trim()).length;

    return (
        <div className="border border-gray-200 rounded-xl bg-white shadow-sm mt-2 overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/60">
                <div>
                    <h4 className="text-sm font-semibold text-gray-800">
                        Options for: <span className="text-blue-700">{definitionName}</span>
                    </h4>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                        {rows.length} rows · {activeCount} active
                        <span className="ml-3">Tab = next cell · Enter = add row · Ctrl+Delete = remove row</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowPaste((v) => !v)}
                        className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg
                                   hover:bg-gray-100 text-gray-600 flex items-center gap-1.5"
                    >
                        📋 Paste from Excel
                    </button>
                    <button
                        type="button"
                        onClick={() => addRow()}
                        className="text-xs px-3 py-1.5 bg-blue-50 border border-blue-200
                                   rounded-lg hover:bg-blue-100 text-blue-700 font-medium"
                    >
                        + Add Row
                    </button>
                </div>
            </div>

            {/* Paste panel */}
            {showPaste && (
                <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
                    <p className="text-xs font-medium text-amber-800 mb-2">
                        Paste from Excel or CSV — two columns: <code className="bg-amber-100 px-1 rounded">CODE_VALUE</code> and <code className="bg-amber-100 px-1 rounded">Display Label</code>
                        <span className="ml-2 font-normal text-amber-600">(Tab or comma separated, one row per line)</span>
                    </p>
                    <textarea
                        className="w-full h-28 px-3 py-2 text-xs font-mono border border-amber-200
                                   rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                        placeholder={"MECH\tMechanical\nELEC\tElectrical\nINST\tInstrumentation"}
                        value={pasteText}
                        onChange={(e) => { setPasteText(e.target.value); parsePaste(e.target.value); }}
                        autoFocus
                    />
                    {pastePreview.length > 0 && (
                        <div className="mt-2">
                            <p className="text-[11px] text-amber-700 mb-1 font-medium">
                                Preview — {pastePreview.length} rows detected:
                            </p>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {pastePreview.map((p, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 text-[11px]
                                                              px-2 py-0.5 bg-white border border-amber-200
                                                              rounded-full font-mono text-gray-700">
                                        <span className="font-bold">{p.code}</span>
                                        {p.label && p.label !== p.code && (
                                            <span className="text-gray-400">/ {p.label}</span>
                                        )}
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={applyPaste}
                                    className="text-xs px-3 py-1.5 bg-amber-600 text-white
                                               rounded-lg hover:bg-amber-700 font-medium"
                                >
                                    ✓ Add {pastePreview.length} rows
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setShowPaste(false); setPasteText(''); setPastePreview([]); }}
                                    className="text-xs px-3 py-1.5 border border-gray-300
                                               rounded-lg hover:bg-gray-100 text-gray-600"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {error && (
                <div className="px-4 py-2 bg-red-50 border-b border-red-100 text-red-700 text-xs">
                    {error}
                </div>
            )}

            {/* Grid */}
            <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="w-6 px-2 py-2" />
                            <th className="text-left py-2 px-2 font-medium text-gray-500 w-8">#</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-500 w-36">Code Value</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-500">Display Label</th>
                            <th className="text-center py-2 px-2 font-medium text-gray-500 w-14">Active</th>
                            <th className="w-8 px-2 py-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={6} className="py-8 text-center text-gray-400 text-xs">
                                    No options yet. Click <strong>+ Add Row</strong> or{' '}
                                    <button
                                        type="button"
                                        className="text-blue-600 underline"
                                        onClick={() => setShowPaste(true)}
                                    >
                                        paste from Excel
                                    </button>
                                    .
                                </td>
                            </tr>
                        )}
                        {rows.map((row, idx) => (
                            <tr
                                key={row._key}
                                draggable
                                onDragStart={() => handleDragStart(idx)}
                                onDragOver={(e) => handleDragOver(e, idx)}
                                onDrop={() => handleDrop(idx)}
                                onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                                className={`border-b border-gray-100 transition-colors ${
                                    dragOverIdx === idx && dragIdx !== idx
                                        ? 'bg-blue-50 border-t-2 border-t-blue-400'
                                        : dragIdx === idx
                                        ? 'opacity-40'
                                        : idx % 2 === 0
                                        ? 'bg-white hover:bg-gray-50/60'
                                        : 'bg-gray-50/40 hover:bg-gray-50'
                                } ${!row.is_active ? 'opacity-50' : ''}`}
                            >
                                {/* Drag handle */}
                                <td className="px-1.5 py-1 cursor-grab text-gray-300 hover:text-gray-500
                                               select-none text-center" title="Drag to reorder">
                                    ⠿
                                </td>

                                {/* Row number */}
                                <td className="py-1 px-2 text-gray-400 font-mono select-none">
                                    {idx + 1}
                                </td>

                                {/* Code Value */}
                                <td className="py-1 px-1">
                                    <input
                                        ref={(el) => { inputRefs.current[`${row._key}_code`] = el; }}
                                        type="text"
                                        value={row.code_value}
                                        onChange={(e) => updateRow(row._key, 'code_value', e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(e, row._key, 'code', idx)}
                                        className="w-full px-2 py-1 border border-transparent rounded
                                                   font-mono uppercase text-[11px] bg-transparent
                                                   hover:border-gray-300 focus:border-blue-400
                                                   focus:bg-blue-50 focus:outline-none focus:ring-1
                                                   focus:ring-blue-400 transition-all"
                                        placeholder="CODE"
                                    />
                                </td>

                                {/* Display Label */}
                                <td className="py-1 px-1">
                                    <input
                                        ref={(el) => { inputRefs.current[`${row._key}_label`] = el; }}
                                        type="text"
                                        value={row.label}
                                        onChange={(e) => updateRow(row._key, 'label', e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(e, row._key, 'label', idx)}
                                        className="w-full px-2 py-1 border border-transparent rounded
                                                   text-[11px] bg-transparent
                                                   hover:border-gray-300 focus:border-blue-400
                                                   focus:bg-blue-50 focus:outline-none focus:ring-1
                                                   focus:ring-blue-400 transition-all"
                                        placeholder="Display Label"
                                    />
                                </td>

                                {/* Active toggle */}
                                <td className="py-1 px-2 text-center">
                                    <input
                                        type="checkbox"
                                        checked={row.is_active}
                                        onChange={(e) => updateRow(row._key, 'is_active', e.target.checked)}
                                        className="rounded border-gray-300 text-blue-600
                                                   focus:ring-blue-500 cursor-pointer"
                                    />
                                </td>

                                {/* Delete */}
                                <td className="py-1 px-1 text-center">
                                    <button
                                        type="button"
                                        onClick={() => removeRow(row._key)}
                                        className="p-1 text-gray-300 hover:text-red-500
                                                   hover:bg-red-50 rounded transition-colors"
                                        title="Remove row (Ctrl+Delete)"
                                    >
                                        ✕
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/40">
                <button
                    type="button"
                    onClick={() => addRow()}
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                >
                    + Add row
                </button>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-3 py-1.5 text-gray-600 text-xs font-medium
                                   rounded-lg border border-gray-300 hover:bg-gray-100"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium
                                   rounded-lg hover:bg-blue-700 disabled:opacity-50
                                   flex items-center gap-1.5"
                    >
                        {saving && (
                            <span className="w-3 h-3 border-2 border-white/30 border-t-white
                                           rounded-full animate-spin" />
                        )}
                        {saving ? 'Saving…' : `Save Options (${rows.filter(r => r.code_value.trim()).length})`}
                    </button>
                </div>
            </div>
        </div>
    );
}
