import React, { useState, useEffect } from 'react';

export function ScenarioControlDashboard({ eventId }: { eventId: string }) {
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [calculatingId, setCalculatingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadScenarios = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/schedule/scenarios`);
      if (res.ok) {
        const data = await res.json();
        setScenarios(data);
        if (selectedScenario) {
          const updated = data.find((s: any) => s.id === selectedScenario.id);
          if (updated) setSelectedScenario(updated);
        }
      } else {
        const err = await res.json();
        setError(err.error || 'Failed to load scenarios');
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (eventId) {
      loadScenarios();
    }
  }, [eventId]);

  const handleCalculate = async (scenarioId: string) => {
    setCalculatingId(scenarioId);
    try {
      const res = await fetch(`/api/events/${eventId}/schedule/scenarios/${scenarioId}/calculate`, {
        method: 'POST',
      });
      if (res.ok) {
        await loadScenarios();
      } else {
        const err = await res.json();
        alert('Calculation failed: ' + (err.error || 'Unknown error'));
      }
    } catch (e: any) {
      alert('Calculation failed: ' + e.message);
    } finally {
      setCalculatingId(null);
    }
  };

  const handlePromote = async (scenarioId: string) => {
    if (!confirm('Are you sure you want to promote this scenario to a Change Request?')) return;
    try {
      const res = await fetch(`/api/events/${eventId}/schedule/scenarios/${scenarioId}/promote`, {
        method: 'POST',
      });
      if (res.ok) {
        alert('Scenario successfully promoted!');
        loadScenarios();
      } else {
        const err = await res.json();
        alert('Failed to promote: ' + err.error);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const getShiBadgeClass = (classification?: string) => {
    switch (classification) {
      case 'GREEN': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'YELLOW': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'ORANGE': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'RED': return 'bg-rose-100 text-rose-800 border-rose-300';
      default: return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const getSeverityBadgeClass = (severity?: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-300';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'WARNING': return 'bg-amber-100 text-amber-800 border-amber-300';
      default: return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  return (
    <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Scenario Planning & Resource Simulation</h2>
          <p className="text-sm text-slate-500 mt-1">Simulate schedule overrides, evaluate resource constraints, and compare SHI health scores.</p>
        </div>
        <button
          onClick={loadScenarios}
          className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm"
        >
          🔄 Refresh
        </button>
      </div>
      
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}
      
      {loading ? (
        <div className="p-8 text-center text-slate-500">Loading scenarios...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Scenario</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">SHI Health</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Resource Constraints</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Finish Delta</th>
                <th className="py-3 px-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scenarios.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 text-sm">
                    No schedule scenarios found. Create a scenario to begin what-if simulations.
                  </td>
                </tr>
              ) : (
                scenarios.map((s) => {
                  const snapshot = s.snapshot_json || {};
                  const health = snapshot.health_metrics;
                  const resAnalysis = snapshot.resource_analysis;
                  const totalConstraints = resAnalysis?.total_constraints ?? 0;
                  const critConstraints = resAnalysis?.critical_count ?? 0;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{s.name}</div>
                        {s.description && <div className="text-xs text-slate-500 truncate max-w-xs">{s.description}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          s.status === 'ready' ? 'bg-emerald-100 text-emerald-800' :
                          s.status === 'draft' ? 'bg-slate-100 text-slate-700' :
                          s.status === 'calculating' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                          'bg-indigo-100 text-indigo-800'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {health ? (
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-0.5 text-xs font-bold border rounded-md ${getShiBadgeClass(health.classification)}`}>
                              {health.classification} ({health.shi})
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Not calculated</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {resAnalysis && resAnalysis.status === 'calculated' ? (
                          totalConstraints === 0 ? (
                            <span className="text-xs text-emerald-600 font-medium">✅ Clean (0)</span>
                          ) : (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${critConstraints > 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                              ⚠️ {totalConstraints} constraints {critConstraints > 0 ? `(${critConstraints} CRITICAL)` : ''}
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium">
                        {s.project_finish_delta !== null && s.project_finish_delta !== undefined ? (
                          s.project_finish_delta > 0 ? (
                            <span className="text-rose-600 font-semibold">+{s.project_finish_delta}d</span>
                          ) : s.project_finish_delta < 0 ? (
                            <span className="text-emerald-600 font-semibold">{s.project_finish_delta}d</span>
                          ) : (
                            <span className="text-slate-600">0d</span>
                          )
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => setSelectedScenario(s)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 shadow-sm"
                        >
                          Inspect
                        </button>
                        {s.status === 'draft' && (
                          <button
                            onClick={() => handleCalculate(s.id)}
                            disabled={calculatingId === s.id}
                            className="px-2.5 py-1 text-xs font-semibold text-white bg-indigo-600 rounded hover:bg-indigo-700 shadow-sm disabled:opacity-50"
                          >
                            {calculatingId === s.id ? 'Calculating...' : 'Calculate'}
                          </button>
                        )}
                        {s.status === 'ready' && (
                          <button
                            onClick={() => handlePromote(s.id)}
                            className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 shadow-sm"
                          >
                            Promote to CR
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Scenario Detail Inspection Modal */}
      {selectedScenario && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 p-6 space-y-6">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{selectedScenario.name}</h3>
                <p className="text-xs text-slate-500 mt-1">Status: <span className="font-semibold text-slate-700">{selectedScenario.status}</span> | Base Baseline ID: {selectedScenario.base_baseline_id || 'None'}</p>
              </div>
              <button
                onClick={() => setSelectedScenario(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {selectedScenario.snapshot_json ? (
              <div className="space-y-6">
                {/* Health Metrics & Summary Cards */}
                {selectedScenario.snapshot_json.health_metrics && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-xs font-semibold text-slate-500 uppercase">Schedule Health Index</div>
                      <div className="mt-2 flex items-baseline space-x-2">
                        <span className="text-3xl font-extrabold text-slate-900">
                          {selectedScenario.snapshot_json.health_metrics.shi}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${getShiBadgeClass(selectedScenario.snapshot_json.health_metrics.classification)}`}>
                          {selectedScenario.snapshot_json.health_metrics.classification}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-xs font-semibold text-slate-500 uppercase">Project Duration</div>
                      <div className="mt-2 flex items-baseline space-x-2">
                        <span className="text-3xl font-extrabold text-slate-900">
                          {selectedScenario.snapshot_json.cpm_result?.total_duration_days ?? '—'}
                        </span>
                        <span className="text-xs text-slate-500">days</span>
                        {selectedScenario.project_finish_delta ? (
                          <span className={`text-xs font-bold ${selectedScenario.project_finish_delta > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            ({selectedScenario.project_finish_delta > 0 ? '+' : ''}{selectedScenario.project_finish_delta}d delta)
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-xs font-semibold text-slate-500 uppercase">Resource Overloads</div>
                      <div className="mt-2 flex items-baseline space-x-2">
                        <span className="text-3xl font-extrabold text-slate-900">
                          {selectedScenario.snapshot_json.resource_analysis?.total_constraints ?? 0}
                        </span>
                        <span className="text-xs text-slate-500">detected</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* SHI Component Breakdown */}
                {selectedScenario.snapshot_json.health_metrics?.components && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Health Component Scores (SHI)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {selectedScenario.snapshot_json.health_metrics.components.map((c: any, i: number) => (
                        <div key={i} className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1">
                          <div className="flex justify-between text-xs font-semibold text-slate-700">
                            <span>{c.name}</span>
                            <span className="font-mono font-bold text-indigo-600">{c.score}/100</span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-tight">{c.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resource Constraints Table */}
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Resource Constraints Analysis</h4>
                  {selectedScenario.snapshot_json.resource_analysis?.constraints?.length > 0 ? (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-slate-200 text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="py-2 px-3 text-left font-semibold text-slate-600">Date</th>
                            <th className="py-2 px-3 text-left font-semibold text-slate-600">Resource Type</th>
                            <th className="py-2 px-3 text-left font-semibold text-slate-600">Severity</th>
                            <th className="py-2 px-3 text-left font-semibold text-slate-600">Demand / Capacity</th>
                            <th className="py-2 px-3 text-left font-semibold text-slate-600">Recommended Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedScenario.snapshot_json.resource_analysis.constraints.map((rc: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono">{rc.date}</td>
                              <td className="py-2 px-3 font-medium text-slate-800">{rc.resource_type_name || rc.resource_type_id}</td>
                              <td className="py-2 px-3">
                                <span className={`px-2 py-0.5 rounded font-bold text-[10px] border ${getSeverityBadgeClass(rc.severity)}`}>
                                  {rc.severity}
                                </span>
                              </td>
                              <td className="py-2 px-3 font-mono">
                                <span className="text-rose-600 font-bold">{rc.planned_demand}</span> / <span className="text-slate-600">{rc.available_capacity}</span>
                              </td>
                              <td className="py-2 px-3 text-slate-600">{rc.recommended_action || 'No action specified'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 bg-emerald-50 text-emerald-800 text-xs rounded-lg border border-emerald-200 font-medium">
                      ✅ No resource overload or capacity bottlenecks detected for this scenario.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 text-sm">
                This scenario has not been calculated yet. Click "Calculate" to generate CPM and resource analysis.
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setSelectedScenario(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Close
              </button>
              {selectedScenario.status === 'draft' && (
                <button
                  onClick={() => {
                    handleCalculate(selectedScenario.id);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm"
                >
                  Calculate Scenario
                </button>
              )}
              {selectedScenario.status === 'ready' && (
                <button
                  onClick={() => {
                    handlePromote(selectedScenario.id);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm"
                >
                  Promote to Change Request
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

