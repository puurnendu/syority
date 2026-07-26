'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

export function SCurveChart({ projectId }: { projectId: string }) {
  const [data, setData] = useState<
    { date: string; planned: number; actual: number }[]
  >([]);
  const [spi, setSpi] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/s-curve`)
      .then((r) => r.json())
      .then((d) => {
        setData(d.sCurve ?? []);
        setSpi(d.evm?.spi ?? 1);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId]);

  if (loading)
    return (
      <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
        Loading S-Curve…
      </div>
    );
  if (!data.length)
    return (
      <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl">
        <div className="text-center">
          <p className="text-gray-400 text-sm">No schedule data yet</p>
          <p className="text-xs text-gray-300 mt-1">
            Set planned start/finish dates on activities
          </p>
        </div>
      </div>
    );

  const today = new Date().toISOString().split('T')[0];
  const spiColor = spi >= 1 ? '#16a34a' : spi >= 0.85 ? '#d97706' : '#dc2626';

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">
          S-Curve — Planned vs Actual
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">SPI</span>
          <span className="text-sm font-bold" style={{ color: spiColor }}>
            {spi.toFixed(2)}
          </span>
          <span className="text-xs text-gray-400">
            {spi >= 1 ? '(ahead)' : '(behind)'}
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            tickFormatter={(d) =>
              new Date(d).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
              })
            }
            interval={Math.max(0, Math.floor(data.length / 6))}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            formatter={(v: unknown) => [`${Number(v ?? 0).toFixed(1)}%`]}
            labelFormatter={(l) =>
              new Date(l).toLocaleDateString('en-IN', { dateStyle: 'medium' })
            }
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine
            x={today}
            stroke="#6366f1"
            strokeDasharray="4 4"
            label={{ value: 'Today', fontSize: 10, fill: '#6366f1' }}
          />
          <Line
            type="monotone"
            dataKey="planned"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            name="Planned %"
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            name="Actual %"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
