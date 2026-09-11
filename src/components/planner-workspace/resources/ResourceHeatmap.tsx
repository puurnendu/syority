'use client';

import { useMemo } from 'react';

interface HeatmapProps {
  data: any[]; // Data from getDemandVsCapacity
  loading: boolean;
}

export function ResourceHeatmap({ data, loading }: HeatmapProps) {
  const processed = useMemo(() => {
    if (!data || data.length === 0) return { dates: [], resources: [], matrix: {} };

    // We only want daily aggregates (shift === null)
    const dailyData = data.filter(d => d.shift === null);

    const datesSet = new Set<string>();
    const resourcesSet = new Map<string, string>(); // id -> name
    const matrix: Record<string, Record<string, any>> = {}; // date -> resource_id -> data

    for (const d of dailyData) {
      datesSet.add(d.date);
      const resKey = `${d.resource_type_id}|${d.contractor_id || 'null'}`;
      let resName = d.resource_type_name;
      if (d.contractor_id) resName += ` (Contractor)`;
      resourcesSet.set(resKey, resName);

      if (!matrix[d.date]) matrix[d.date] = {};
      matrix[d.date][resKey] = d;
    }

    const dates = Array.from(datesSet).sort();
    const resources = Array.from(resourcesSet.entries()).map(([id, name]) => ({ id, name }));

    return { dates, resources, matrix };
  }, [data]);

  if (loading) {
    return <div className="h-64 bg-gray-100 animate-pulse rounded-xl" />;
  }

  if (processed.dates.length === 0) {
    return <div className="text-gray-400 text-sm py-8 text-center bg-white border border-gray-200 rounded-xl">No resource data available for heatmap.</div>;
  }

  const getStatusColor = (util: number, variance: number) => {
    if (util > 100 || variance < 0) return 'bg-red-500 text-white';
    if (util >= 90) return 'bg-orange-400 text-white';
    if (util >= 80) return 'bg-yellow-300 text-gray-900';
    if (util > 0) return 'bg-green-100 text-green-900';
    return 'bg-gray-50 text-gray-400';
  };

  const getStatusLabel = (util: number, variance: number) => {
    if (util > 100 || variance < 0) return 'CRITICAL';
    if (util >= 90) return 'AT_RISK';
    if (util >= 80) return 'WATCH';
    return 'NORMAL';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Resource Heatmap</h3>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> CRITICAL</span>
          <span className="flex items-center gap-1"><div className="w-3 h-3 bg-orange-400 rounded-sm"></div> AT RISK</span>
          <span className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-300 rounded-sm"></div> WATCH</span>
          <span className="flex items-center gap-1"><div className="w-3 h-3 bg-green-100 border border-green-200 rounded-sm"></div> NORMAL</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr>
              <th className="p-3 bg-gray-50 border-b border-r border-gray-200 font-semibold text-gray-600 sticky left-0 z-10 w-48">Resource</th>
              {processed.dates.map(date => (
                <th key={date} className="p-2 border-b border-gray-200 bg-gray-50 text-center font-medium text-gray-500 min-w-[60px]">
                  {new Date(date).getDate()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processed.resources.map(res => (
              <tr key={res.id}>
                <td className="p-3 border-b border-r border-gray-200 bg-white sticky left-0 z-10 font-medium text-gray-900 truncate">
                  {res.name}
                </td>
                {processed.dates.map(date => {
                  const cell = processed.matrix[date]?.[res.id];
                  if (!cell) {
                    return <td key={date} className="p-1 border-b border-gray-200 bg-gray-50" />;
                  }
                  
                  const util = cell.utilization_percent || 0;
                  const variance = cell.variance;
                  const colorClass = getStatusColor(util, variance);
                  const status = getStatusLabel(util, variance);

                  return (
                    <td key={date} className="p-1 border-b border-gray-200 text-center">
                      <div 
                        className={`w-full h-8 flex items-center justify-center rounded-sm font-semibold cursor-help ${colorClass}`}
                        title={`${status} - Util: ${util}%, Deficit: ${variance < 0 ? Math.abs(variance) : 0}`}
                      >
                        {util > 0 ? Math.round(util) : ''}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
