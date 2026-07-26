'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function DashboardClient({ metrics, workpacks }: { metrics: any, workpacks: any[] }) {
  
  // Aggregate data for Burn-down chart
  // This is a naive implementation: grouping closed workpacks by day
  const dataMap = new Map<string, number>();
  
  workpacks.forEach(w => {
    if (w.status.toLowerCase() === 'closed' && w.updated_at) {
      const date = new Date(w.updated_at).toISOString().split('T')[0];
      dataMap.set(date, (dataMap.get(date) || 0) + 1);
    }
  });

  const sortedDates = Array.from(dataMap.keys()).sort();
  let remaining = metrics.totalWP;
  const burnDownData = sortedDates.map(date => {
    remaining -= dataMap.get(date) || 0;
    return { date, remaining };
  });

  // If no closed items, create a flat line
  if (burnDownData.length === 0) {
    burnDownData.push({ date: new Date().toISOString().split('T')[0], remaining: metrics.totalWP });
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Total Scope</h3>
          <p className="mt-1 text-2xl font-bold text-gray-900">{metrics.totalWP}</p>
          <p className="text-xs text-gray-400 mt-1">Workpacks</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Execution</h3>
          <p className="mt-1 text-2xl font-bold text-blue-600">{metrics.executionWP}</p>
          <p className="text-xs text-gray-400 mt-1">Active</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Closed</h3>
          <p className="mt-1 text-2xl font-bold text-green-600">{metrics.closedWP}</p>
          <p className="text-xs text-gray-400 mt-1">Completed</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Progress</h3>
          <p className="mt-1 text-2xl font-bold text-indigo-600">{metrics.percentComplete}%</p>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
            <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${metrics.percentComplete}%` }}></div>
          </div>
        </div>
      </div>

      {/* Burn-down Chart */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm h-96">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Workpack Burn-down</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={burnDownData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line 
              type="monotone" 
              name="Remaining Scope" 
              dataKey="remaining" 
              stroke="#4f46e5" 
              strokeWidth={3} 
              activeDot={{ r: 8 }} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
