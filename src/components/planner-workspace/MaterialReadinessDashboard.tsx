'use client';

/**
 * M8.12 — Material Readiness Dashboard
 *
 * Displays material readiness status, supply chain overview,
 * binding constraints, and recent supply activity for an event.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

interface DashboardData {
  summary: {
    total_material_lines: number;
    critical_count: number;
    ready_count: number;
    partial_count: number;
    not_ready_count: number;
    blocked_count: number;
    not_assessed_count: number;
    overall_readiness_percent: number;
  };
  supply_overview: {
    total_supply_records: number;
    pending_deliveries: number;
    in_transit: number;
    received: number;
    delayed: number;
  };
  binding_constraints: {
    activity_id: string;
    activity_description: string;
    constraint_date: string | null;
    impact_days: number;
    readiness_status: string;
    material_description: string;
  }[];
  recent_supply_activity: {
    id: string;
    po_number: string | null;
    supplier_name: string | null;
    quantity_ordered: number;
    delivery_status: string;
    expected_delivery: string | null;
    material_description: string;
  }[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  ready: { label: 'Ready', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  partial: { label: 'Partial', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  not_ready: { label: 'Not Ready', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  blocked: { label: 'Blocked', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  not_assessed: { label: 'Not Assessed', color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200' },
};

const DELIVERY_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'text-gray-600' },
  confirmed: { label: 'Confirmed', color: 'text-blue-600' },
  in_transit: { label: 'In Transit', color: 'text-indigo-600' },
  partial: { label: 'Partial', color: 'text-amber-600' },
  received: { label: 'Received', color: 'text-emerald-600' },
  delayed: { label: 'Delayed', color: 'text-red-600' },
  cancelled: { label: 'Cancelled', color: 'text-gray-400' },
};

export function MaterialReadinessDashboard() {
  const selectedEventId = useWorkspaceStore((s) => s.selectedEventId);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  const fetchData = useCallback(async () => {
    if (!selectedEventId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${selectedEventId}/materials/constraints`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setData(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedEventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRecalculate = async () => {
    if (!selectedEventId) return;
    setRecalculating(true);
    try {
      const res = await fetch(`/api/events/${selectedEventId}/materials/recalculate`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Recalculation failed');
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRecalculating(false);
    }
  };

  if (!selectedEventId) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center p-8">
          <p className="text-xl text-gray-500">📦 Material Readiness</p>
          <p className="text-sm text-gray-400 mt-2">Select an event to view material readiness data</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8">
          <p className="text-red-500">Error: {error}</p>
          <button onClick={fetchData} className="mt-2 text-blue-600 text-sm hover:underline">Retry</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const s = data.summary;
  const so = data.supply_overview;

  return (
    <div className="h-full overflow-auto bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">📦 Material Readiness Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">
            {s.total_material_lines} material lines • {s.critical_count} critical
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {recalculating ? '⏳ Recalculating...' : '🔄 Recalculate Constraints'}
          </button>
          <button
            onClick={fetchData}
            className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        {/* Overall Readiness */}
        <div className="col-span-2 bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase">Overall Readiness</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{s.overall_readiness_percent}%</p>
          <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all"
              style={{ width: `${s.overall_readiness_percent}%` }}
            />
          </div>
        </div>

        {/* Status cards */}
        {Object.entries(STATUS_CONFIG).filter(([k]) => k !== 'not_assessed').map(([key, cfg]) => {
          const count = key === 'ready' ? s.ready_count
            : key === 'partial' ? s.partial_count
            : key === 'not_ready' ? s.not_ready_count
            : s.blocked_count;

          return (
            <div key={key} className={`rounded-lg border ${cfg.border} ${cfg.bg} p-4 shadow-sm`}>
              <p className={`text-xs font-medium uppercase ${cfg.color}`}>{cfg.label}</p>
              <p className={`text-2xl font-bold mt-1 ${cfg.color}`}>{count}</p>
              <p className="text-xs text-gray-400 mt-1">
                {s.total_material_lines > 0
                  ? `${Math.round((count / s.total_material_lines) * 100)}%`
                  : '0%'}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Supply Overview */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Supply Chain Overview</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Supply Records</span>
              <span className="text-sm font-semibold text-gray-900">{so.total_supply_records}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">📋 Pending</span>
              <span className="text-sm font-semibold text-gray-600">{so.pending_deliveries}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">🚚 In Transit</span>
              <span className="text-sm font-semibold text-indigo-600">{so.in_transit}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">✅ Received</span>
              <span className="text-sm font-semibold text-emerald-600">{so.received}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">⚠️ Delayed</span>
              <span className="text-sm font-semibold text-red-600">{so.delayed}</span>
            </div>
          </div>
        </div>

        {/* Binding Constraints */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Binding Material Constraints</h3>
          {data.binding_constraints.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No binding constraints found</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-auto">
              {data.binding_constraints.map((c, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-red-50 rounded border border-red-100">
                  <span className="text-xs font-semibold text-red-700">
                    +{c.impact_days}d
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{c.activity_description}</p>
                    <p className="text-xs text-gray-500">Constraint: {c.constraint_date || 'N/A'}</p>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_CONFIG[c.readiness_status]?.bg || 'bg-gray-100'} ${STATUS_CONFIG[c.readiness_status]?.color || 'text-gray-500'}`}>
                    {STATUS_CONFIG[c.readiness_status]?.label || c.readiness_status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Supply Activity */}
      <div className="mt-6 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-5 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Recent Supply Activity</h3>
        </div>
        {data.recent_supply_activity.length === 0 ? (
          <p className="p-5 text-sm text-gray-400 italic">No supply records found</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Material</th>
                <th className="px-4 py-2 text-left">PO #</th>
                <th className="px-4 py-2 text-left">Supplier</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">ETA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.recent_supply_activity.map((r) => {
                const dCfg = DELIVERY_STATUS_CONFIG[r.delivery_status] || { label: r.delivery_status, color: 'text-gray-500' };
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900 truncate max-w-[200px]">{r.material_description}</td>
                    <td className="px-4 py-2 text-gray-600">{r.po_number || '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{r.supplier_name || '—'}</td>
                    <td className="px-4 py-2 text-right text-gray-900">{r.quantity_ordered}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs font-medium ${dCfg.color}`}>{dCfg.label}</span>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{r.expected_delivery || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
