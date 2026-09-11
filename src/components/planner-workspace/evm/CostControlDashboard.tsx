'use client';

/**
 * M8.10 — Cost Control Dashboard (EVM)
 *
 * Enterprise Earned Value Management dashboard providing:
 * - EVM KPI Cards (BAC, PV, EV, AC, CV, SV, CPI, SPI, EAC, ETC, VAC, TCPI)
 * - S-Curve visualization (PV vs EV vs AC)
 * - WBS drill-down tree
 * - Scenario EVM comparison
 *
 * This is a NEW component — does NOT modify the M8.8 ScheduleControlDashboard.
 * Architecture Lock: M8.10_ARCHITECTURE_LOCK.md §1
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, AreaChart,
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────────────

interface EvmSummary {
  eventId: string;
  baselineId: string;
  dataDate: string;
  bac: number;
  pv: number;
  ev: number;
  ac: number;
  cv: number;
  sv: number;
  cpi: number | null;
  spi: number | null;
  eac: number | null;
  etc: number | null;
  vac: number | null;
  tcpi: number | null;
  costLoadedActivities: number;
  totalActivities: number;
  costLoadedPercent: number;
}

interface EvmCurveData {
  dates: string[];
  pv: number[];
  ev: number[];
  ac: number[];
  eacProjection: (number | null)[];
}

interface WbsEvmNode {
  id: string;
  name: string;
  level: string;
  bac: number;
  pv: number;
  ev: number;
  ac: number;
  cv: number;
  sv: number;
  cpi: number | null;
  spi: number | null;
  children?: WbsEvmNode[];
}

// ── Helper functions ───────────────────────────────────────────────────

function fmtCurrency(n: number | null): string {
  if (n === null || n === undefined) return 'N/A';
  return '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtIndex(n: number | null): string {
  if (n === null || n === undefined) return 'N/A';
  return n.toFixed(2);
}

function getVarianceColor(value: number | null): string {
  if (value === null) return '#94a3b8';
  if (value > 0) return '#22c55e';
  if (value < 0) return '#ef4444';
  return '#94a3b8';
}

function getIndexColor(value: number | null, type: 'cpi' | 'spi'): string {
  if (value === null) return '#94a3b8';
  if (value >= 1.0) return '#22c55e';
  if (value >= 0.9) return '#eab308';
  return '#ef4444';
}

type TabKey = 'kpis' | 'scurve' | 'drilldown';

const TABS: Record<TabKey, { label: string; icon: string }> = {
  kpis: { label: 'EVM KPIs', icon: '💰' },
  scurve: { label: 'S-Curve', icon: '📈' },
  drilldown: { label: 'Drill-Down', icon: '🔍' },
};

// ── Main Component ─────────────────────────────────────────────────────

export function CostControlDashboard() {
  const { selectedEventId } = useWorkspaceStore();
  const [activeTab, setActiveTab] = useState<TabKey>('kpis');

  const [summary, setSummary] = useState<EvmSummary | null>(null);
  const [curve, setCurve] = useState<EvmCurveData | null>(null);
  const [drillDown, setDrillDown] = useState<WbsEvmNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!selectedEventId) return;
    setLoading(true);
    setError(null);

    try {
      const base = `/api/events/${selectedEventId}/schedule/evm`;

      const results = await Promise.allSettled([
        fetch(`${base}/summary`).then(r => r.json()),
        fetch(`${base}/s-curve`).then(r => r.json()),
        fetch(`${base}/drill-down`).then(r => r.json()),
      ]);

      if (results[0].status === 'fulfilled' && results[0].value.data) {
        setSummary(results[0].value.data);
      }
      if (results[1].status === 'fulfilled' && results[1].value.data) {
        setCurve(results[1].value.data);
      }
      if (results[2].status === 'fulfilled' && results[2].value.data) {
        setDrillDown(results[2].value.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load EVM data');
    } finally {
      setLoading(false);
    }
  }, [selectedEventId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!selectedEventId) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
        <p style={{ fontSize: 18, fontWeight: 600 }}>💰 Cost Control Dashboard</p>
        <p>Select an event to view EVM analysis</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxHeight: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#f8fafc' }}>
          💰 Cost Control Dashboard (EVM)
        </h2>
        <button
          onClick={fetchData}
          disabled={loading}
          style={{
            padding: '6px 16px', borderRadius: 6, border: '1px solid #334155',
            background: '#1e293b', color: '#e2e8f0', cursor: 'pointer', fontSize: 13,
          }}
        >
          {loading ? '⏳ Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, marginBottom: 12, borderRadius: 6, background: '#7f1d1d22', border: '1px solid #991b1b', color: '#fca5a5', fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {(Object.keys(TABS) as TabKey[]).map(key => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: activeTab === key ? '#3b82f6' : '#1e293b',
              color: activeTab === key ? '#ffffff' : '#94a3b8',
              transition: 'all 0.2s',
            }}
          >
            {TABS[key].icon} {TABS[key].label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'kpis' && <KpiPanel summary={summary} loading={loading} />}
      {activeTab === 'scurve' && <SCurvePanel curve={curve} loading={loading} />}
      {activeTab === 'drilldown' && <DrillDownPanel node={drillDown} loading={loading} />}
    </div>
  );
}

// ── KPI Panel ──────────────────────────────────────────────────────────

function KpiPanel({ summary, loading }: { summary: EvmSummary | null; loading: boolean }) {
  if (loading) return <LoadingState />;
  if (!summary) return <EmptyState message="No EVM data available. Ensure a baseline is active and activities have budgeted costs." />;

  return (
    <div>
      {/* Budget and Performance Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <KpiCard label="BAC" value={fmtCurrency(summary.bac)} subtitle="Budget at Completion" color="#3b82f6" />
        <KpiCard label="PV" value={fmtCurrency(summary.pv)} subtitle="Planned Value" color="#8b5cf6" />
        <KpiCard label="EV" value={fmtCurrency(summary.ev)} subtitle="Earned Value" color="#22c55e" />
        <KpiCard label="AC" value={fmtCurrency(summary.ac)} subtitle="Actual Cost" color="#ef4444" />
      </div>

      {/* Variance Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <KpiCard label="CV" value={fmtCurrency(summary.cv)} subtitle="Cost Variance (EV-AC)" color={getVarianceColor(summary.cv)} />
        <KpiCard label="SV" value={fmtCurrency(summary.sv)} subtitle="Schedule Variance (EV-PV)" color={getVarianceColor(summary.sv)} />
        <KpiCard label="CPI" value={fmtIndex(summary.cpi)} subtitle="Cost Performance Index" color={getIndexColor(summary.cpi, 'cpi')} />
        <KpiCard label="SPI" value={fmtIndex(summary.spi)} subtitle="Schedule Performance Index" color={getIndexColor(summary.spi, 'spi')} />
      </div>

      {/* Forecast Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <KpiCard label="EAC" value={fmtCurrency(summary.eac)} subtitle="Estimate at Completion" color="#f59e0b" />
        <KpiCard label="ETC" value={fmtCurrency(summary.etc)} subtitle="Estimate to Complete" color="#f59e0b" />
        <KpiCard label="VAC" value={fmtCurrency(summary.vac)} subtitle="Variance at Completion" color={getVarianceColor(summary.vac)} />
        <KpiCard label="TCPI" value={fmtIndex(summary.tcpi)} subtitle="To-Complete Performance Index" color="#06b6d4" />
      </div>

      {/* Coverage Info */}
      <div style={{
        padding: 12, borderRadius: 8, background: '#1e293b', border: '1px solid #334155',
        display: 'flex', gap: 24, fontSize: 13, color: '#94a3b8',
      }}>
        <span>📅 Data Date: <strong style={{ color: '#e2e8f0' }}>{summary.dataDate}</strong></span>
        <span>📊 Activities: <strong style={{ color: '#e2e8f0' }}>{summary.costLoadedActivities}/{summary.totalActivities}</strong> cost-loaded ({summary.costLoadedPercent}%)</span>
      </div>
    </div>
  );
}

function KpiCard({ label, value, subtitle, color }: { label: string; value: string; subtitle: string; color: string }) {
  return (
    <div style={{
      padding: 16, borderRadius: 8, background: '#0f172a', border: `1px solid ${color}33`,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc' }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#64748b' }}>
        {subtitle}
      </div>
    </div>
  );
}

// ── S-Curve Panel ──────────────────────────────────────────────────────

function SCurvePanel({ curve, loading }: { curve: EvmCurveData | null; loading: boolean }) {
  if (loading) return <LoadingState />;
  if (!curve || !curve.dates.length) return <EmptyState message="No S-curve data available." />;

  const chartData = curve.dates.map((date, i) => ({
    date: date.slice(5), // MM-DD format
    PV: curve.pv[i],
    EV: curve.ev[i],
    AC: curve.ac[i],
    EAC: curve.eacProjection[i],
  }));

  return (
    <div style={{ padding: 16, borderRadius: 8, background: '#0f172a', border: '1px solid #334155' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#e2e8f0' }}>
        📈 Earned Value S-Curve
      </h3>
      <ResponsiveContainer width="100%" height={360}>
        <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
          <YAxis stroke="#64748b" fontSize={11} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: '#94a3b8' }}
            formatter={(value: any) => ['$' + Number(value).toLocaleString()]}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
          <Area type="monotone" dataKey="PV" stroke="#8b5cf6" fill="#8b5cf644" strokeWidth={2} name="Planned Value" />
          <Area type="monotone" dataKey="EV" stroke="#22c55e" fill="#22c55e44" strokeWidth={2} name="Earned Value" />
          <Area type="monotone" dataKey="AC" stroke="#ef4444" fill="#ef444444" strokeWidth={2} name="Actual Cost" />
          {chartData.some(d => d.EAC !== null) && (
            <Line type="monotone" dataKey="EAC" stroke="#f59e0b" strokeDasharray="5 5" strokeWidth={1.5} dot={false} name="EAC Projection" />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Drill-Down Panel ───────────────────────────────────────────────────

function DrillDownPanel({ node, loading }: { node: WbsEvmNode | null; loading: boolean }) {
  if (loading) return <LoadingState />;
  if (!node) return <EmptyState message="No drill-down data available." />;

  return (
    <div style={{ borderRadius: 8, border: '1px solid #334155', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#1e293b' }}>
            {['WBS Item', 'BAC', 'PV', 'EV', 'AC', 'CV', 'SV', 'CPI', 'SPI'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: h === 'WBS Item' ? 'left' : 'right', color: '#94a3b8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <DrillDownRow node={node} depth={0} />
        </tbody>
      </table>
    </div>
  );
}

function DrillDownRow({ node, depth }: { node: WbsEvmNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const indent = depth * 20;

  const rowBg = depth === 0 ? '#0f172a' : depth === 1 ? '#1e293b11' : 'transparent';
  const fontWeight = depth <= 1 ? 600 : 400;

  return (
    <>
      <tr style={{ background: rowBg, borderBottom: '1px solid #334155' }}>
        <td style={{ padding: '6px 12px', paddingLeft: 12 + indent, fontWeight, color: '#e2e8f0', cursor: hasChildren ? 'pointer' : 'default' }}
            onClick={() => hasChildren && setExpanded(!expanded)}>
          {hasChildren && <span style={{ marginRight: 6, fontSize: 10 }}>{expanded ? '▼' : '▶'}</span>}
          <span style={{ fontSize: 11, color: '#64748b', marginRight: 6 }}>
            {node.level === 'event' ? '🏗️' : node.level === 'workpack' ? '📦' : '🔧'}
          </span>
          {node.name}
        </td>
        <td style={cellRight}>{fmtCurrency(node.bac)}</td>
        <td style={cellRight}>{fmtCurrency(node.pv)}</td>
        <td style={cellRight}>{fmtCurrency(node.ev)}</td>
        <td style={cellRight}>{fmtCurrency(node.ac)}</td>
        <td style={{ ...cellRight, color: getVarianceColor(node.cv) }}>{fmtCurrency(node.cv)}</td>
        <td style={{ ...cellRight, color: getVarianceColor(node.sv) }}>{fmtCurrency(node.sv)}</td>
        <td style={{ ...cellRight, color: getIndexColor(node.cpi, 'cpi') }}>{fmtIndex(node.cpi)}</td>
        <td style={{ ...cellRight, color: getIndexColor(node.spi, 'spi') }}>{fmtIndex(node.spi)}</td>
      </tr>
      {expanded && hasChildren && node.children!.map(child => (
        <DrillDownRow key={child.id} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

const cellRight: React.CSSProperties = {
  padding: '6px 12px', textAlign: 'right', color: '#e2e8f0', fontSize: 13, fontVariantNumeric: 'tabular-nums',
};

// ── Shared States ──────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
      <p>Loading EVM data...</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
      <p>{message}</p>
    </div>
  );
}
