'use client';

// ── Types ────────────────────────────────────────────────────────────────

type StatChip = {
    label: string;
    count: number;
    color?: 'default' | 'green' | 'amber' | 'red' | 'blue' | 'orange';
    onClick?: () => void;
    /** If true, renders as a warning badge */
    isWarning?: boolean;
};

type RegisterSummaryBarProps = {
    totalLabel: string;
    total: number;
    filtered: number;
    stats: StatChip[];
};

// ── Color map ────────────────────────────────────────────────────────────

const COLOR_CLASSES: Record<string, string> = {
    default: 'bg-gray-100 text-gray-600',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
    orange: 'bg-orange-100 text-orange-700',
};

// ── Component ────────────────────────────────────────────────────────────

export function RegisterSummaryBar({ totalLabel, total, filtered, stats }: RegisterSummaryBarProps) {
    const isFiltered = filtered < total;

    return (
        <div className="flex flex-wrap items-center gap-2 mb-3 px-1">
            {/* Total count */}
            <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-gray-900 leading-none tabular-nums">{filtered.toLocaleString()}</span>
                {isFiltered && (
                    <span className="text-xs text-gray-400">of {total.toLocaleString()}</span>
                )}
                <span className="text-sm text-gray-500">{totalLabel}</span>
            </div>

            {/* Divider */}
            <div className="w-px h-5 bg-gray-200 mx-1" />

            {/* Stat chips */}
            {stats.map((stat) => {
                const colorClass = stat.isWarning && stat.count > 0
                    ? COLOR_CLASSES.amber
                    : COLOR_CLASSES[stat.color ?? 'default'];

                return (
                    <button
                        key={stat.label}
                        type="button"
                        onClick={stat.onClick}
                        disabled={!stat.onClick}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-opacity ${colorClass} ${
                            stat.onClick ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
                        } ${stat.isWarning && stat.count > 0 ? 'ring-1 ring-amber-300' : ''}`}
                    >
                        {stat.isWarning && stat.count > 0 && (
                            <span className="text-amber-600">⚠</span>
                        )}
                        <span className="tabular-nums font-bold">{stat.count.toLocaleString()}</span>
                        <span className="opacity-80">{stat.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
