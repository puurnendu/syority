'use client';

export type RelationshipType = 'FS' | 'SS' | 'FF' | 'SF';

const TYPE_LABELS: Record<RelationshipType, string> = {
    FS: 'FS',
    SS: 'SS',
    FF: 'FF',
    SF: 'SF',
};
const TYPE_TITLES: Record<RelationshipType, string> = {
    FS: 'Finish-to-Start: B starts after A finishes (default)',
    SS: 'Start-to-Start: B starts when A starts',
    FF: 'Finish-to-Finish: B finishes when A finishes',
    SF: 'Start-to-Finish: B finishes when A starts (rare)',
};

type Props = {
    code: string;
    name: string;
    type: RelationshipType;
    lagHours: number;
    onTypeChange: (type: RelationshipType) => void;
    onLagChange: (hours: number) => void;
    onRemove: () => void;
};

export function PredecessorRow({ code, name, type, lagHours, onTypeChange, onLagChange, onRemove }: Props) {
    return (
        <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-gray-50 border border-gray-100 text-xs">
            <span className="font-mono text-gray-800 truncate max-w-[100px]" title={name}>{code}</span>
            <span className="text-gray-500 truncate flex-1 min-w-0" title={name}>{name}</span>
            <select
                value={type}
                onChange={(e) => onTypeChange(e.target.value as RelationshipType)}
                title={TYPE_TITLES[type]}
                className="rounded border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-gray-700"
            >
                {(Object.keys(TYPE_LABELS) as RelationshipType[]).map((t) => (
                    <option key={t} value={t} title={TYPE_TITLES[t]}>{TYPE_LABELS[t]}</option>
                ))}
            </select>
            <label className="flex items-center gap-1 text-gray-600">
                Lag:
                <input
                    type="number"
                    value={lagHours}
                    onChange={(e) => onLagChange(Number(e.target.value) || 0)}
                    step={0.5}
                    className="w-14 rounded border border-gray-200 px-1.5 py-0.5 text-right"
                />
                h
            </label>
            <button
                type="button"
                onClick={onRemove}
                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                title="Remove predecessor"
            >
                ✕
            </button>
        </div>
    );
}
