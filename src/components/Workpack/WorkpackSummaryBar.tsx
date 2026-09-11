'use client';

/**
 * M8.13 GOVERNANCE: PRESENTATION-ONLY — reads cached overall_progress from workpacks.
 * The cached value is synced by the authoritative ProgressCalculationService via
 * FieldExecutionService.syncWorkpackProgress or ProgressAggregationService.recalculateEvent.
 */
export function WorkpackSummaryBar({ workpacks }: { workpacks: any[] }) {
    if (workpacks.length === 0) return null;

    const total = workpacks.length;
    const active = workpacks.filter(
        (w) => w.status === 'in_progress' || w.status === 'active'
    ).length;
    const complete = workpacks.filter(
        (w) =>
            w.status === 'complete' ||
            w.status === 'completed' ||
            ((w.overall_progress ?? 0) as number) >= 100
    ).length;
    const blocked = workpacks.filter((w) => (w.open_constraints ?? 0) > 0).length;
    const avgProgress =
        total > 0
            ? Math.round(
                  workpacks.reduce((s, w) => s + ((w.overall_progress ?? 0) as number), 0) / total
              )
            : 0;

    const stats = [
        { label: 'Total', value: total, cls: 'text-gray-800' },
        { label: 'Active', value: active, cls: 'text-blue-600' },
        { label: 'Complete', value: complete, cls: 'text-green-600' },
        { label: 'Blocked', value: blocked, cls: 'text-red-600' },
        { label: 'Avg Progress', value: `${avgProgress}%`, cls: 'text-gray-800' },
    ];

    return (
        <div className="grid grid-cols-5 gap-4 mb-6">
            {stats.map((s) => (
                <div
                    key={s.label}
                    className="bg-white border border-gray-200 rounded-2xl px-4 py-3 text-center"
                >
                    <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                </div>
            ))}
        </div>
    );
}
