'use client';

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';
import { ResourceLoadingResult } from './types';

export function ResourceLoadingHistogram({ data }: { data: ResourceLoadingResult[] }) {
  // We only chart the daily aggregated results (shift = null) 
  // because demand is currently only aggregated daily.
  const chartData = useMemo(() => {
    // Group by Date
    const dailyMap = new Map<string, { date: string, demand: number, capacity: number, overAllocated: boolean }>();
    
    data.forEach(r => {
      if (r.shift === null) {
        const existing = dailyMap.get(r.date) || { date: r.date, demand: 0, capacity: 0, overAllocated: false };
        existing.demand += Number(r.planned_demand || 0);
        existing.capacity += Number(r.available_capacity || 0);
        if (r.is_over_allocated) {
          existing.overAllocated = true;
        }
        dailyMap.set(r.date, existing);
      }
    });

    return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  if (chartData.length === 0) {
    return <div className="h-full flex items-center justify-center text-gray-400 text-sm">No data for chart</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{
          top: 20,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 10, fill: '#6b7280' }} 
          tickFormatter={(val) => {
            const d = new Date(val);
            return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
          }}
        />
        <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
        <Tooltip 
          contentStyle={{ fontSize: 12, borderRadius: 4, border: '1px solid #d1d5db' }}
          labelStyle={{ fontWeight: 'bold', color: '#374151', marginBottom: 4 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="capacity" name="Available Capacity" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="demand" name="Planned Demand" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.overAllocated ? '#ef4444' : '#10b981'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
