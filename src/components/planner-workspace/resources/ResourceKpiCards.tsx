'use client';

import { ProjectResourceKpis } from '@/core/resources/ResourceKpiService';

export function ResourceKpiCards({ kpis, loading }: { kpis: ProjectResourceKpis | null; loading: boolean }) {
  if (loading) {
    return <div className="animate-pulse flex gap-4 overflow-x-auto p-4"><div className="h-24 w-48 bg-gray-200 rounded-xl"></div><div className="h-24 w-48 bg-gray-200 rounded-xl"></div></div>;
  }

  if (!kpis) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Demand</span>
        <span className="text-2xl font-bold text-gray-900 mt-2">{kpis.total_demand}</span>
      </div>
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Avail. Capacity</span>
        <span className="text-2xl font-bold text-gray-900 mt-2">{kpis.total_capacity}</span>
      </div>
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Utilization</span>
        <span className={`text-2xl font-bold mt-2 ${kpis.average_utilization > 100 ? 'text-red-600' : kpis.average_utilization >= 90 ? 'text-amber-500' : 'text-green-600'}`}>
          {kpis.average_utilization}%
        </span>
      </div>
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Deficit</span>
        <span className={`text-2xl font-bold mt-2 ${kpis.total_deficit > 0 ? 'text-red-600' : 'text-gray-900'}`}>{kpis.total_deficit}</span>
      </div>
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Overloaded Days</span>
        <span className={`text-2xl font-bold mt-2 ${kpis.overloaded_days > 0 ? 'text-red-600' : 'text-gray-900'}`}>{kpis.overloaded_days}</span>
      </div>
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Peak Utilization</span>
        <span className={`text-2xl font-bold mt-2 ${kpis.peak_utilization > 100 ? 'text-red-600' : 'text-gray-900'}`}>{kpis.peak_utilization}%</span>
      </div>
    </div>
  );
}
