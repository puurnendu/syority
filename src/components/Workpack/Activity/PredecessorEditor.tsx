'use client';

import { useState } from 'react';
import { PredecessorRow, type RelationshipType } from './PredecessorRow';
import { AddPredecessorRow } from './AddPredecessorRow';

export type PredecessorItem = {
    predecessorId: string;
    type: RelationshipType;
    lagHours: number;
};

type ActivityOption = { id: string; activity_number: string | null; sequence_number: number | null; description: string };

type Props = {
    workpackId: string;
    activityId: string;
    activities: ActivityOption[];
    predecessors: PredecessorItem[];
    onSave: (predecessors: PredecessorItem[]) => Promise<void>;
    onCancel: () => void;
};

export function PredecessorEditor({ workpackId, activityId, activities, predecessors: initial, onSave, onCancel }: Props) {
    const [list, setList] = useState<PredecessorItem[]>(() => [...initial]);
    const [showAdd, setShowAdd] = useState(false);
    const [saving, setSaving] = useState(false);

    const excludeIds = new Set([activityId, ...list.map((p) => p.predecessorId)]);
    const activityOptions = activities.map((a) => ({
        id: a.id,
        activity_number: a.activity_number,
        sequence_number: a.sequence_number,
        description: a.description ?? '',
    }));

    const handleAdd = (predecessorId: string, type: RelationshipType, lagHours: number) => {
        if (list.some((p) => p.predecessorId === predecessorId)) return;
        setList((prev) => [...prev, { predecessorId, type, lagHours }]);
        setShowAdd(false);
    };

    const handleRemove = (index: number) => {
        setList((prev) => prev.filter((_, i) => i !== index));
    };

    const handleTypeChange = (index: number, type: RelationshipType) => {
        setList((prev) => prev.map((p, i) => (i === index ? { ...p, type } : p)));
    };

    const handleLagChange = (index: number, lagHours: number) => {
        setList((prev) => prev.map((p, i) => (i === index ? { ...p, lagHours } : p)));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(list);
        } finally {
            setSaving(false);
        }
    };

    const getActivity = (id: string) => activities.find((a) => a.id === id);

    return (
        <div className="min-w-[320px] max-w-[480px] p-2 space-y-2 bg-white border border-gray-200 rounded-xl shadow-lg">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Predecessors</span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {list.map((p, index) => {
                    const act = getActivity(p.predecessorId);
                    return (
                        <PredecessorRow
                            key={`${p.predecessorId}-${index}`}
                            code={act?.activity_number ?? String(act?.sequence_number ?? '')}
                            name={act?.description ?? ''}
                            type={p.type}
                            lagHours={p.lagHours}
                            onTypeChange={(type) => handleTypeChange(index, type)}
                            onLagChange={(lag) => handleLagChange(index, lag)}
                            onRemove={() => handleRemove(index)}
                        />
                    );
                })}
                {showAdd ? (
                    <AddPredecessorRow
                        activityOptions={activityOptions}
                        excludeIds={excludeIds}
                        onAdd={handleAdd}
                        onCancel={() => setShowAdd(false)}
                    />
                ) : (
                    <button
                        type="button"
                        onClick={() => setShowAdd(true)}
                        className="w-full py-1.5 px-2 text-left text-xs text-blue-600 hover:bg-blue-50 rounded-lg border border-dashed border-gray-200"
                    >
                        + Add Predecessor
                    </button>
                )}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg">
                    Cancel
                </button>
                <button type="button" onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save'}
                </button>
            </div>
        </div>
    );
}
