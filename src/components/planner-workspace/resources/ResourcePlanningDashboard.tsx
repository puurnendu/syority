'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { ResourceLoadingResult, ResourceTypeSummary, ContractorSummary, ShiftDefinition } from './types';
import { ResourceLoadingHistogram } from './ResourceLoadingHistogram';
import { ResourceLoadingMatrix } from './ResourceLoadingMatrix';
import { ResourceAvailabilityMatrix } from './ResourceAvailabilityMatrix';
import { ShiftConfigurationPanel } from './ShiftConfigurationPanel';
import LevelingPreviewModal from '@/components/Schedule/LevelingPreviewModal';
import { ResourceKpiCards } from './ResourceKpiCards';
import { ResourceHeatmap } from './ResourceHeatmap';
import { ResourceForecastChart } from './ResourceForecastChart';
import { ResourceRiskPanel } from './ResourceRiskPanel';
import { ResourceTrendPanel } from './ResourceTrendPanel';

export function ResourcePlanningDashboard() {
  const { selectedEventId, selectedEventName } = useWorkspaceStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loadingResults, setLoadingResults] = useState<ResourceLoadingResult[]>([]);
  const [resourceTypes, setResourceTypes] = useState<ResourceTypeSummary[]>([]);
  const [contractors, setContractors] = useState<ContractorSummary[]>([]);
  const [shifts, setShifts] = useState<ShiftDefinition[]>([]);

  // Filters
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterResourceTypeId, setFilterResourceTypeId] = useState('all');
  const [filterContractorId, setFilterContractorId] = useState('all');

  const [refreshKey, setRefreshKey] = useState(0);
  const [showShiftConfig, setShowShiftConfig] = useState(false);
  const [showSimulationModal, setShowSimulationModal] = useState(false);

  // Intelligence State
  const [kpis, setKpis] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [risks, setRisks] = useState(null);
  const [intelligenceErrors, setIntelligenceErrors] = useState<string[]>([]);

  // Initialize dates
  useEffect(() => {
    const start = new Date();
    start.setDate(start.getDate() - 7);
    const end = new Date();
    end.setDate(end.getDate() + 30);
    setFilterStartDate(start.toISOString().slice(0, 10));
    setFilterEndDate(end.toISOString().slice(0, 10));
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedEventId) return;
    setLoading(true);
    setError(null);
    try {
      // Build query string
      const params = new URLSearchParams();
      if (filterStartDate) params.append('startDate', filterStartDate);
      if (filterEndDate) params.append('endDate', filterEndDate);
      if (filterResourceTypeId !== 'all') params.append('resourceTypeId', filterResourceTypeId);
      if (filterContractorId !== 'all') params.append('contractorId', filterContractorId);

      const [resLoading, resTypes, resContractors, resShifts, resKpis, resForecast, resRisks] = await Promise.all([
        fetch(`/api/events/${selectedEventId}/resource-loading?${params.toString()}`),
        fetch(`/api/organizations/resource-types`),
        fetch(`/api/organizations/contractors`),
        fetch(`/api/events/${selectedEventId}/shifts`),
        fetch(`/api/events/${selectedEventId}/schedule/resource-kpis?${params.toString()}`),
        fetch(`/api/events/${selectedEventId}/schedule/resource-forecast?${params.toString()}`),
        fetch(`/api/events/${selectedEventId}/schedule/resource-risks?${params.toString()}`),
      ]);

      if (!resLoading.ok) throw new Error('Failed to fetch resource loading data');

      const dataLoading = await resLoading.json();
      setLoadingResults(dataLoading.data || []);

      // If we don't have endpoints for RTs and Contractors, we can derive them from the results, but that only shows active ones.
      // We will try to parse them if available, else fallback.
      if (resTypes.ok) {
        const rts = await resTypes.json();
        setResourceTypes(rts.data || rts);
      } else {
        // Derive from results
        const map = new Map<string, string>();
        (dataLoading.data || []).forEach((r: any) => {
          map.set(r.resource_type_id, r.resource_type_name);
        });
        setResourceTypes(Array.from(map.entries()).map(([id, name]) => ({ id, name })));
      }

      if (resContractors.ok) {
        const cons = await resContractors.json();
        setContractors(cons.data || cons);
      } else {
        setContractors([]);
      }

      if (resShifts.ok) {
        const sh = await resShifts.json();
        setShifts(sh.data || []);
      }

      const intErrors: string[] = [];
      if (resKpis.ok) {
        setKpis(await resKpis.json());
      } else {
        intErrors.push(`KPIs: ${resKpis.status} ${resKpis.statusText}`);
        setKpis(null);
      }
      if (resForecast.ok) {
        setForecast(await resForecast.json());
      } else {
        intErrors.push(`Forecast: ${resForecast.status} ${resForecast.statusText}`);
        setForecast(null);
      }
      if (resRisks.ok) {
        setRisks(await resRisks.json());
      } else {
        intErrors.push(`Risks: ${resRisks.status} ${resRisks.statusText}`);
        setRisks(null);
      }
      setIntelligenceErrors(intErrors);

    } catch (err: any) {
      setError(err.message || 'An error occurred while loading resource data.');
    } finally {
      setLoading(false);
    }
  }, [selectedEventId, filterStartDate, filterEndDate, filterResourceTypeId, filterContractorId, refreshKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // We don't need the local summary memo anymore as we use ResourceKpiCards

  if (!selectedEventId) {
    return (
      <div className="flex items-center justify-center h-full bg-white text-gray-500">
        Please select an Event to view Resource Planning.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-auto">
      {/* Header Area */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div>
          <h2 className="text-lg font-bold text-gray-800">RESOURCE PLANNING</h2>
          <p className="text-sm text-gray-500">Event: {selectedEventName}</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowSimulationModal(true)}
            className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded shadow-sm font-medium transition-colors flex items-center gap-2"
          >
            ✨ Run What-If Simulation
          </button>
          <button 
            onClick={() => setShowShiftConfig(!showShiftConfig)}
            className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 font-medium text-gray-700"
          >
            ⚙️ Shift Config
          </button>
          <button 
            onClick={() => setRefreshKey(k => k + 1)}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded shadow-sm font-medium"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-end gap-4 px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex flex-col">
          <label className="text-xs font-semibold text-gray-600 mb-1">Start Date</label>
          <input 
            type="date" 
            value={filterStartDate} 
            onChange={e => setFilterStartDate(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm bg-gray-50"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-semibold text-gray-600 mb-1">End Date</label>
          <input 
            type="date" 
            value={filterEndDate} 
            onChange={e => setFilterEndDate(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm bg-gray-50"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-semibold text-gray-600 mb-1">Resource Type</label>
          <select 
            value={filterResourceTypeId} 
            onChange={e => setFilterResourceTypeId(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm bg-gray-50 min-w-[150px]"
          >
            <option value="all">All Resources</option>
            {resourceTypes.map(rt => (
              <option key={rt.id} value={rt.id}>{rt.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-semibold text-gray-600 mb-1">Contractor</label>
          <select 
            value={filterContractorId} 
            onChange={e => setFilterContractorId(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm bg-gray-50 min-w-[150px]"
          >
            <option value="all">All Contractors</option>
            {contractors.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="m-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded text-sm flex items-center gap-2">
          <span>❌</span>
          {error}
        </div>
      )}

      {/* Intelligence Errors Warning */}
      {intelligenceErrors.length > 0 && (
        <div className="mx-4 mt-2 p-3 bg-amber-50 border border-amber-300 text-amber-800 rounded text-sm">
          <span className="font-medium">⚠️ Intelligence panel errors:</span>
          <ul className="ml-4 mt-1 list-disc">
            {intelligenceErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Loading State */}
      {loading && !loadingResults.length && (
        <div className="flex justify-center p-8">
          <div className="animate-pulse flex flex-col items-center gap-2">
            <div className="h-8 w-8 bg-blue-400 rounded-full"></div>
            <span className="text-sm text-gray-500">Loading resource data...</span>
          </div>
        </div>
      )}

      {/* Main Content Areas */}
      {!loading && !error && loadingResults.length === 0 && (
        <div className="m-4 p-8 text-center border-2 border-dashed border-gray-300 rounded-lg text-gray-500 bg-white">
          <p className="text-lg mb-1">📭 No resource demand found for this period.</p>
          <p className="text-sm">Try adjusting your date range or filters.</p>
        </div>
      )}

      {loadingResults.length > 0 && (
        <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
          
          <ResourceKpiCards kpis={kpis} loading={loading} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 flex flex-col gap-4">
              <ResourceTrendPanel data={loadingResults} loading={loading} />
              <ResourceHeatmap data={loadingResults} loading={loading} />
            </div>
            <div className="flex flex-col gap-4">
              <ResourceRiskPanel risks={risks} loading={loading} />
            </div>
          </div>

          <ResourceForecastChart forecast={forecast} loading={loading} />

          {/* Histogram */}
          <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
            <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Demand vs Capacity Histogram</h3>
            <div className="h-64">
              <ResourceLoadingHistogram data={loadingResults} />
            </div>
          </div>

          {/* Loading Matrix */}
          <div className="bg-white rounded border border-gray-200 shadow-sm flex-1 min-h-[300px] flex flex-col">
            <div className="p-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Resource Loading Matrix</h3>
            </div>
            <div className="flex-1 overflow-hidden">
              <ResourceLoadingMatrix data={loadingResults} shifts={shifts} />
            </div>
          </div>

          {/* Availability Matrix / Editor */}
          <div className="bg-white rounded border border-gray-200 shadow-sm min-h-[300px] flex flex-col">
            <div className="p-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Resource Availability (Capacity Entry)</h3>
            </div>
            <div className="flex-1 overflow-hidden">
              <ResourceAvailabilityMatrix 
                eventId={selectedEventId}
                resourceTypes={resourceTypes}
                contractors={contractors}
                shifts={shifts}
                startDate={filterStartDate}
                endDate={filterEndDate}
                onCapacityChanged={() => setRefreshKey(k => k + 1)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showShiftConfig && (
        <ShiftConfigurationPanel 
          eventId={selectedEventId} 
          onClose={() => setShowShiftConfig(false)} 
          onShiftsChanged={() => setRefreshKey(k => k + 1)}
          shifts={shifts}
        />
      )}

      {showSimulationModal && (
        <LevelingPreviewModal 
          isOpen={showSimulationModal}
          onClose={() => setShowSimulationModal(false)}
          eventId={selectedEventId}
          onApplied={() => setRefreshKey(k => k + 1)}
        />
      )}
    </div>
  );
}
