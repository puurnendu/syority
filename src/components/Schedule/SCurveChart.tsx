'use client';

import React, { useMemo } from 'react';
import useSWR from 'swr';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export const SCurveChart = ({ projectId }: { projectId: string }) => {
  const { data, error, isLoading } = useSWR(`/api/projects/${projectId}/s-curve`, fetcher);

  const chartData = useMemo(() => {
    if (!data?.timeSeries) return [];
    
    return data.timeSeries.map((pt: any) => ({
      name: pt.date,
      Planned: pt.bcws,
      Earned: pt.bcwp,
      Actual: pt.acwp,
      Forecast: pt.forecast
    }));
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-white border-t border-gray-200">
        <div className="text-sm text-gray-500 animate-pulse">Loading S-Curve data...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 bg-white border-t border-gray-200">
        <div className="text-sm text-red-500">Failed to load S-Curve.</div>
      </div>
    );
  }

  const kpis = data.metrics;

  return (
    <div className="flex flex-col h-72 bg-white border-t border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-800">Earned Value S-Curve</h3>
        
        {/* KPI Cards */}
        {kpis && (
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">SPI</span>
              <span className={`text-sm font-bold ${kpis.spi >= 1 ? 'text-green-600' : 'text-red-600'}`}>
                {kpis.spi?.toFixed(2)}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">CPI</span>
              <span className={`text-sm font-bold ${kpis.cpi >= 1 ? 'text-green-600' : 'text-red-600'}`}>
                {kpis.cpi?.toFixed(2)}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">SV</span>
              <span className={`text-sm font-bold ${kpis.sv >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {kpis.sv >= 0 ? '+' : ''}{kpis.sv?.toFixed(1)}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">CV</span>
              <span className={`text-sm font-bold ${kpis.cv >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {kpis.cv >= 0 ? '+' : ''}{kpis.cv?.toFixed(1)}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPlanned" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorEarned" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              minTickGap={30}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}
            />
            <Tooltip 
              contentStyle={{ fontSize: '11px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            
            <Area type="monotone" dataKey="Planned" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorPlanned)" />
            <Area type="monotone" dataKey="Earned" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorEarned)" />
            <Area type="monotone" dataKey="Actual" stroke="#f59e0b" strokeWidth={2} fill="none" />
            <Area type="dashed" dataKey="Forecast" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" fill="none" />
            
            {data.dataDate && (
              <ReferenceLine x={data.dataDate} stroke="#ef4444" strokeDasharray="3 3">
                <text x="50%" y="10" fill="#ef4444" fontSize={10} textAnchor="middle">Data Date</text>
              </ReferenceLine>
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
