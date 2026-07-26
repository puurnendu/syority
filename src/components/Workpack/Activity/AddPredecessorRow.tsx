'use client';

import { useState } from 'react';
import type { RelationshipType } from './PredecessorRow';

type ActivityOption = { id: string; activity_number: string | null; sequence_number: number | null; description: string };

type Props = {
    activityOptions: ActivityOption[];
    excludeIds: Set<string>;
    onAdd: (predecessorId: string, type: RelationshipType, lagHours: number) => void;
    onCancel: () => void;
};

export function AddPredecessorRow({ activityOptions, excludeIds, onAdd, onCancel }: Props) {
    const [predecessorId, setPredecessorId] = useState('');
    const [type, setType] = useState<RelationshipType>('FS');
    const [lagHours, setLagHours] = useState(0);

    const options = activityOptions.filter((a) => !excludeIds.has(a.id));
    const canAdd = predecessorId && options.some((o) => o.id === predecessorId);

    return (
        <div className="flex items-center gap-2 py-2 px-2 rounded-lg bg-blue-50 border border-blue-100 text-xs">
            <select
                value={predecessorId}
                onChange={(e) => setPredecessorId(e.target.value)}
                className="flex-1 min-w-0 rounded border border-gray-200 bg-white px-2 py-1 text-gray-700"
            >
                <option value="">Select activity…</option>
                {options.map((a) => (
                    <option key={a.id} value={a.id}>
                        {a.activity_number ?? a.sequence_number ?? a.id.slice(0, 8)} — {(a.description ?? '').slice(0, 40)}
                    </option>
                ))}
            </select>
            <select
                value={type}
                onChange={(e) => setType(e.target.value as RelationshipType)}
                className="rounded border border-gray-200 bg-white px-1.5 py-0.5 font-mono"
            >
                <option value="FS">FS</option>
                <option value="SS">SS</option>
                <option value="FF">FF</option>
                <option value="SF">SF</option>
            </select>
            <input
                type="number"
                value={lagHours}
                onChange={(e) => setLagHours(Number(e.target.value) || 0)}
                step={0.5}
                placeholder="0"
                className="w-14 rounded border border-gray-200 px-1.5 py-0.5 text-right"
            />
            <span className="text-gray-500">h</span>
            <button
                type="button"
                onClick={() => canAdd && onAdd(predecessorId, type, lagHours)}
                disabled={!canAdd}
                className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
                ✓ Add
            </button>
            <button type="button" onClick={onCancel} className="px-2 py-1 text-gray-600 hover:bg-gray-200 rounded">
                ✕ Cancel
            </button>
        </div>
    );
}
