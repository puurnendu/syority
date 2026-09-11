'use client';

import { useMemo } from 'react';

interface TrendProps {
  data: any[]; // Data from getDemandVsCapacity
  loading: boolean;
}

export function ResourceTrendPanel({ data, loading }: TrendProps) {
  const trends = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Group by date
    const dailyData = data.filter(d => d.shift === null);
    const byDate = new Map<string, { date: string, demand: number, capacity: number, deficit: number }>();
    
    for (const d of dailyData) {
      if (!byDate.has(d.date)) {
        byDate.set(d.date, { date: d.date, demand: 0, capacity: 0, deficit: 0 });
      }
      const p = byDate.get(d.date)!;
      p.demand += d.planned_demand;
      p.capacity += d.available_capacity;
      if (d.variance < 0) {
        p.deficit += Math.abs(d.variance);
      }
    }
    
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  if (loading) return <div className="h-48 bg-gray-100 animate-pulse rounded-xl" />;
  if (trends.length === 0) return null;

  const maxVal = Math.max(...trends.map(t => Math.max(t.demand, t.capacity, 1)));

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Total Resource Demand vs Capacity Trend</h3>
      <div className="h-40 flex items-end gap-1 overflow-x-auto pb-2">
        {trends.map((t) => {
          const demandHeight = (t.demand / maxVal) * 100;
          const capHeight = (t.capacity / maxVal) * 100;
          return (
            <div key={t.date} className="flex flex-col items-center flex-shrink-0 w-8 group">
              <div className="relative w-full h-full flex items-end justify-center">
                {/* Capacity line */}
                <div 
                  className="absolute bottom-0 w-full bg-gray-200 opacity-50 rounded-t-sm"
                  style={{ height: `${capHeight}%` }}
                />
                {/* Demand Bar */}
                <div 
                  className={`w-4/5 rounded-t-sm z-10 ${t.deficit > 0 ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ height: `${demandHeight}%` }}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full mb-1 hidden group-hover:block z-20 bg-gray-900 text-white text-[10px] p-1 rounded whitespace-nowrap">
                  {t.date}<br/>
                  Dem: {t.demand.toFixed(1)}<br/>
                  Cap: {t.capacity.toFixed(1)}
                </div>
              </div>
              <div className="text-[9px] text-gray-400 mt-1 truncate w-full text-center">
                {new Date(t.date).getDate()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
