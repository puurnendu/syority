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
import { mapEventCurveToChart, NO_SCHEDULE_PROGRESS_DATA } from '@/core/evm/mapEventCurveToChart';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  return { ok: res.ok, status: res.status, json };
};

export const SCurveChart = ({ eventId }: { eventId: string }) => {
  const { data: curveRes, error: curveError, isLoading: curveLoading } = useSWR(
    eventId ? `/api/events/${eventId}/schedule/evm/s-curve` : null,
    fetcher
  );
  const { data: summaryRes, isLoading: summaryLoading } = useSWR(
    eventId ? `/api/events/${eventId}/schedule/evm/summary` : null,
    fetcher
  );

  const model = useMemo(() => {
    const curve = curveRes?.json?.data ?? null;
    const summary = summaryRes?.json?.data ?? null;
    return mapEventCurveToChart(curve, summary);
  }, [curveRes, summaryRes]);

  if (curveLoading || summaryLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-white border-t border-gray-200">
        <div className="text-sm text-gray-500 animate-pulse">Loading S-Curve data...</div>
      </div>
    );
  }

  if (curveError || curveRes?.status === 422) {
    return (
      <div className="flex items-center justify-center h-64 bg-white border-t border-gray-200">
        <div className="text-sm text-gray-500">{NO_SCHEDULE_PROGRESS_DATA}</div>
      </div>
    );
  }

  if (!curveRes?.ok && curveRes?.status === 404) {
    return (
      <div className="flex items-center justify-center h-64 bg-white border-t border-gray-200">
        <div className="text-sm text-gray-500">{NO_SCHEDULE_PROGRESS_DATA}</div>
      </div>
    );
  }

  if (!model.available) {
    return (
      <div className="flex items-center justify-center h-64 bg-white border-t border-gray-200">
        <div className="text-sm text-gray-500">{NO_SCHEDULE_PROGRESS_DATA}</div>
      </div>
    );
  }

  const kpis = model.metrics;

  return (
    <div className="flex flex-col h-72 bg-white border-t border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-800">Earned Value S-Curve</h3>

        {kpis && (
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">SPI</span>
              <span className={`text-sm font-bold ${(kpis.spi ?? 0) >= 1 ? 'text-green-600' : 'text-red-600'}`}>
                {kpis.spi?.toFixed(2)}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">CPI</span>
              <span className={`text-sm font-bold ${(kpis.cpi ?? 0) >= 1 ? 'text-green-600' : 'text-red-600'}`}>
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
          <AreaChart data={model.timeSeries} margin={{ top: 5, right: 20, left: -20, bottom: 0 }}>
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

            {model.dataDate && (
              <ReferenceLine x={model.dataDate} stroke="#ef4444" strokeDasharray="3 3">
                <text x="50%" y="10" fill="#ef4444" fontSize={10} textAnchor="middle">Data Date</text>
              </ReferenceLine>
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
