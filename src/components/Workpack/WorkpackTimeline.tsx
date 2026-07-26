'use client';

type Stage = {
    id: string;
    label: string;
    icon: string;
    tabKey: string;
};

const STAGE_CONFIG: Stage[] = [
    { id: 'activities', label: 'Activities', icon: '📋', tabKey: 'activities' },
    { id: 'materials', label: 'Materials', icon: '🔩', tabKey: 'materials' },
    { id: 'preparation', label: 'Preparation', icon: '🔧', tabKey: 'preparation' },
    { id: 'cleaning', label: 'Cleaning', icon: '🧹', tabKey: 'cleaning' },
    { id: 'constraints', label: 'Constraints', icon: '⚠️', tabKey: 'constraints' },
    { id: 'joints_blinds', label: 'Joints/Blinds', icon: '🔗', tabKey: 'joints_blinds' },
    { id: 'qa_clearance', label: 'QA/Clearance', icon: '✅', tabKey: 'qa_clearance' },
    { id: 'certificates', label: 'Certificates', icon: '📜', tabKey: 'certificates' },
    { id: 'documents', label: 'Documents', icon: '📁', tabKey: 'documents' },
    { id: 'lessons', label: 'Lessons', icon: '💡', tabKey: 'lessons' },
];

type StageStatus = 'not_started' | 'in_progress' | 'complete' | 'blocked';

const STATUS_STYLES: Record<StageStatus, { ring: string; bg: string; text: string; label: string }> = {
    not_started: { ring: 'ring-gray-200', bg: 'bg-gray-100', text: 'text-gray-400', label: 'Not started' },
    in_progress: { ring: 'ring-blue-400', bg: 'bg-blue-50', text: 'text-blue-600', label: 'In progress' },
    complete: { ring: 'ring-green-400', bg: 'bg-green-50', text: 'text-green-600', label: 'Complete' },
    blocked: { ring: 'ring-red-400', bg: 'bg-red-50', text: 'text-red-500', label: 'Blocked' },
};

type SectionCounts = {
    activities?: number;
    materials?: number;
    preparation?: number;
    cleaning?: number;
    constraints?: number;
    joints_blinds?: number;
    qa_clearance?: number;
    certificates?: number;
    documents?: number;
    lessons?: number;
};

export function WorkpackTimeline({
    workpack,
    summaryData,
    sectionCounts = {},
    onTabChange,
}: {
    workpack: any;
    summaryData?: {
        open_constraints: number;
        pending_certs: number;
        open_hold_points: number;
    };
    sectionCounts?: SectionCounts;
    onTabChange?: (tabId: string) => void;
}) {
    function getCount(tabKey: string): number {
        const key = tabKey === 'joints_blinds' ? 'joints_blinds' : tabKey;
        return sectionCounts[key as keyof SectionCounts] ?? 0;
    }

    function stageStatus(tabKey: string): StageStatus {
        const count = getCount(tabKey);
        if (tabKey === 'constraints') {
            if ((summaryData?.open_constraints ?? 0) > 0) return 'blocked';
            return count === 0 ? 'not_started' : 'in_progress';
        }
        if (tabKey === 'certificates') {
            if ((summaryData?.pending_certs ?? 0) > 0) return 'in_progress';
            return count === 0 ? 'not_started' : 'in_progress';
        }
        if (tabKey === 'qa_clearance') {
            if ((summaryData?.open_hold_points ?? 0) > 0) return 'in_progress';
            return count === 0 ? 'not_started' : 'in_progress';
        }
        if (count === 0) return 'not_started';
        const prog = (workpack?.overall_progress ?? 0) as number;
        if (prog >= 100) return 'complete';
        return 'in_progress';
    }

    const stagesWithCount = STAGE_CONFIG.map((s) => ({
        ...s,
        count: getCount(s.tabKey),
        status: stageStatus(s.tabKey),
    }));
    const completedCount = stagesWithCount.filter((s) => s.status === 'complete').length;
    const inProgressCount = stagesWithCount.filter((s) => s.status === 'in_progress').length;
    const overallProgress = Math.round(
        ((completedCount + inProgressCount * 0.5) / STAGE_CONFIG.length) * 100
    );

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-sm font-semibold text-gray-900">Workpack Progress</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {completedCount} of {STAGE_CONFIG.length} stages complete · {overallProgress}% overall
                    </p>
                </div>
                <div className="relative w-14 h-14 flex-none">
                    <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                        <circle cx="28" cy="28" r="22" fill="none" stroke="#E5E7EB" strokeWidth="5" />
                        <circle
                            cx="28"
                            cy="28"
                            r="22"
                            fill="none"
                            stroke={overallProgress >= 100 ? '#10B981' : '#3B82F6'}
                            strokeWidth="5"
                            strokeLinecap="round"
                            strokeDasharray={`${(2 * Math.PI * 22 * overallProgress) / 100} 999`}
                        />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-800">
                        {overallProgress}%
                    </span>
                </div>
            </div>

            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-5">
                <div
                    className="h-1.5 rounded-full transition-all bg-blue-500"
                    style={{ width: `${Math.min(100, overallProgress)}%` }}
                />
            </div>

            <div className="grid grid-cols-5 gap-3">
                {stagesWithCount.map((stage) => {
                    const style = STATUS_STYLES[stage.status];
                    const isEmpty = stage.count === 0;

                    return (
                        <button
                            key={stage.id}
                            onClick={() => onTabChange?.(stage.tabKey)}
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl ring-2 transition-all text-center hover:scale-105 active:scale-95 ${style.ring} ${style.bg}`}
                            title={`Go to ${stage.label} · ${stage.count} item${stage.count !== 1 ? 's' : ''} (${style.label})`}
                        >
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ring-2 ${style.ring} bg-white ${isEmpty ? 'text-gray-300' : ''}`}
                            >
                                {stage.status === 'complete' ? '✓' : stage.status === 'blocked' ? '!' : stage.count}
                            </div>
                            <span className="text-lg leading-none">{stage.icon}</span>
                            <span className={`text-xs font-medium leading-tight ${style.text}`}>{stage.label}</span>
                            <span className={`text-xs leading-none ${style.text} opacity-75`}>
                                {isEmpty ? style.label : `${stage.count} item${stage.count !== 1 ? 's' : ''}`}
                            </span>
                        </button>
                    );
                })}
            </div>

            {(summaryData?.open_constraints ?? 0) > 0 && (
                <div className="mt-4 flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                    <span>⚠</span>
                    <span>
                        {summaryData!.open_constraints} open constraint
                        {summaryData!.open_constraints !== 1 ? 's' : ''} — resolve before final reinstatement.
                    </span>
                    <button
                        onClick={() => onTabChange?.('constraints')}
                        className="ml-auto underline font-medium whitespace-nowrap"
                    >
                        View →
                    </button>
                </div>
            )}
        </div>
    );
}
