'use client';

import Link from 'next/link';

export type SystemProgressItem = {
  systemId: string;
  systemCode: string;
  systemName: string;
  unitName: string;
  criticality: string;
  planningProgress: number;
  workpackCount: number;
  activityCount: number;
  status: string;
  planningChecks: {
    workpacksExist: boolean;
    activitiesAdded: boolean;
    activitiesAddedRatio: number;
    datesSet: boolean;
    datesSetRatio: number;
    materialsAdded: boolean;
    materialsAddedRatio: number;
    blindListPopulated: boolean;
    gasketRegPopulated: boolean;
    drawingAttached: boolean;
    procedureAttached: boolean;
    wbsGenerated: boolean;
  };
};

function progressBarColor(pct: number): string {
  if (pct === 0) return '#475569';
  if (pct < 50) return '#D97706';
  if (pct < 90) return '#2563EB';
  if (pct < 100) return '#7C3AED';
  return '#059669';
}

function statusBadgeClass(status: string): string {
  if (status === 'Planned') return 'bg-green-100 text-green-800';
  if (status === 'In Planning') return 'bg-amber-100 text-amber-800';
  return 'bg-gray-100 text-gray-700';
}

export function SystemProgressCard({ item }: { item: SystemProgressItem }) {
  const barColor = progressBarColor(item.planningProgress);
  const borderColor = barColor;

  const tooltipLines = [
    { label: 'Workpacks created', done: item.planningChecks.workpacksExist },
    {
      label: 'Activities added',
      done: item.planningChecks.activitiesAdded,
      partial: !item.planningChecks.activitiesAdded && item.planningChecks.activitiesAddedRatio > 0,
      ratio: item.planningChecks.activitiesAddedRatio,
    },
    {
      label: 'Dates set on activities',
      done: item.planningChecks.datesSet,
      partial: !item.planningChecks.datesSet && item.planningChecks.datesSetRatio > 0,
      ratio: item.planningChecks.datesSetRatio,
    },
    {
      label: 'Materials added',
      done: item.planningChecks.materialsAdded,
      partial: !item.planningChecks.materialsAdded && item.planningChecks.materialsAddedRatio > 0,
      ratio: item.planningChecks.materialsAddedRatio,
    },
    { label: 'Blind list populated', done: item.planningChecks.blindListPopulated },
    { label: 'Gasket register populated', done: item.planningChecks.gasketRegPopulated },
    { label: 'Drawing attached', done: item.planningChecks.drawingAttached },
    { label: 'Procedure attached', done: item.planningChecks.procedureAttached },
    { label: 'WBS generated', done: item.planningChecks.wbsGenerated },
  ];

  return (
    <Link href={`/planning/systems/${item.systemId}`}>
      <div
        className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
        style={{ borderTopWidth: 4, borderTopColor: borderColor }}
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-semibold text-gray-900">
                  {item.systemCode || '—'}
                </span>
                {item.criticality && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                    {item.criticality}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-gray-800 mt-0.5">{item.systemName}</p>
            </div>
            <span className="text-xs text-gray-500 shrink-0">→</span>
          </div>

          <p className="text-xs text-gray-500 mb-3">Planning Progress</p>
          <div
            className="h-2 rounded-full bg-gray-100 overflow-hidden mb-3"
            title={tooltipLines
              .map((l) =>
                l.done
                  ? `✅ ${l.label}`
                  : (l as any).partial
                    ? `⚠ ${l.label} (${Math.round((l as any).ratio * 100)}%)`
                    : `❌ ${l.label}`
              )
              .join('\n')}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${item.planningProgress}%`, backgroundColor: barColor }}
            />
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-2">{item.planningProgress}%</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-600">
              {item.workpackCount} WPs • {item.activityCount} Activities
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadgeClass(item.status)}`}
            >
              {item.status}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
