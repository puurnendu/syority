'use client';

import React, { useMemo } from 'react';
import { ResourceLoadingResult, ShiftDefinition } from './types';

export function ResourceLoadingMatrix({ data, shifts }: { data: ResourceLoadingResult[], shifts: ShiftDefinition[] }) {
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      // Primary sort by date
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      // Secondary sort by Resource Name
      if (a.resource_type_name !== b.resource_type_name) return a.resource_type_name.localeCompare(b.resource_type_name);
      // Tertiary sort by Shift (Daily first)
      if (a.shift === null && b.shift !== null) return -1;
      if (a.shift !== null && b.shift === null) return 1;
      return 0;
    });
  }, [data]);

  const getShiftName = (shiftId: string | null) => {
    if (!shiftId || shiftId === 'null') return 'Daily (Aggregated)';
    const s = shifts.find(x => x.id === shiftId);
    return s ? s.name : 'Unknown Shift';
  };

  return (
    <div className="w-full h-full overflow-auto">
      <table className="w-full text-left border-collapse min-w-[800px]">
        <thead className="sticky top-0 bg-gray-100 shadow-sm z-10">
          <tr className="text-xs uppercase text-gray-500 tracking-wider">
            <th className="p-3 border-b border-gray-200">Date</th>
            <th className="p-3 border-b border-gray-200">Resource Type</th>
            <th className="p-3 border-b border-gray-200">Shift</th>
            <th className="p-3 border-b border-gray-200">Demand</th>
            <th className="p-3 border-b border-gray-200">Capacity</th>
            <th className="p-3 border-b border-gray-200">Variance</th>
            <th className="p-3 border-b border-gray-200">Utilization</th>
            <th className="p-3 border-b border-gray-200">Status</th>
          </tr>
        </thead>
        <tbody className="bg-white text-sm">
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={8} className="p-4 text-center text-gray-500">No data available</td>
            </tr>
          ) : (
            sortedData.map((row, idx) => {
              const isOver = row.is_over_allocated;
              const hasDemand = row.planned_demand > 0;
              const hasCap = row.available_capacity > 0;

              return (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="p-3 whitespace-nowrap text-gray-700">{row.date}</td>
                  <td className="p-3 font-medium text-gray-800">{row.resource_type_name}</td>
                  <td className="p-3 text-gray-600">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-semibold ${row.shift === null ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-700'}`}>
                      {getShiftName(row.shift)}
                    </span>
                  </td>
                  <td className="p-3 text-gray-800">{row.planned_demand}</td>
                  <td className="p-3 text-gray-800">{row.available_capacity}</td>
                  <td className={`p-3 font-medium ${row.variance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {row.variance > 0 ? '+' : ''}{row.variance}
                  </td>
                  <td className="p-3 text-gray-700">
                    {row.utilization_percent !== null ? `${row.utilization_percent}%` : '-'}
                  </td>
                  <td className="p-3">
                    {isOver ? (
                      <span className="px-2 py-1 text-xs bg-red-100 text-red-700 font-bold rounded">OVER</span>
                    ) : (hasDemand || hasCap) ? (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-700 font-bold rounded">OK</span>
                    ) : (
                      <span className="px-2 py-1 text-xs text-gray-400 font-medium">N/A</span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
