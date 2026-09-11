'use client';

import React, { useState, useEffect } from 'react';
import { FiX, FiCheck, FiAlertCircle, FiInfo } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { LevelingRecommendation, LevelingSimulationResult } from '@/core/resources/ResourceLevelingService';

interface LevelingPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  onApplied: () => void;
}

export default function LevelingPreviewModal({ isOpen, onClose, eventId, onApplied }: LevelingPreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<LevelingSimulationResult | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchRecommendations();
    } else {
      setScenario(null);
      setError(null);
    }
  }, [isOpen, eventId]);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/schedule/level-resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch recommendations');
      }

      setScenario(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!scenario || !scenario.scenario_id || scenario.proposed_changes.length === 0) return;
    
    setApplying(true);
    try {
      const res = await fetch(`/api/events/${eventId}/schedule/level-resources/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simulation_id: scenario.scenario_id, // For backward compatibility with apply service
          recommendations: scenario.proposed_changes
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to apply recommendations');
      }

      toast.success('Resource leveling recommendations applied successfully.');
      onApplied();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error applying recommendations.');
    } finally {
      setApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 font-sans">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#2b7344] text-white">
          <h2 className="text-lg font-semibold tracking-tight">Resource Leveling Preview (What-If Scenario)</h2>
          <button onClick={onClose} className="text-white hover:text-green-200 transition-colors">
            <FiX size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto bg-gray-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2b7344] mb-4"></div>
              <p className="text-sm text-gray-500">Running leveling simulation...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
              <div className="flex items-center">
                <FiAlertCircle className="text-red-500 mr-2" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          ) : !scenario || (scenario.proposed_changes.length === 0 && scenario.warnings.length === 0) ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No resource constraints detected or no leveling recommendations available.</p>
              <button 
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-5 gap-4">
                 <div className="bg-white p-4 rounded border shadow-sm flex flex-col">
                    <span className="text-xs text-gray-500 uppercase">Constraints Before</span>
                    <span className="text-2xl font-bold">{scenario.constraints_before}</span>
                 </div>
                 <div className="bg-white p-4 rounded border shadow-sm flex flex-col">
                    <span className="text-xs text-gray-500 uppercase">Constraints Resolved</span>
                    <span className="text-2xl font-bold text-green-600">{scenario.constraints_resolved}</span>
                 </div>
                 <div className="bg-white p-4 rounded border shadow-sm flex flex-col">
                    <span className="text-xs text-gray-500 uppercase">Constraints Remaining</span>
                    <span className="text-2xl font-bold text-orange-600">{scenario.constraints_remaining}</span>
                 </div>
                 <div className="bg-white p-4 rounded border shadow-sm flex flex-col">
                    <span className="text-xs text-gray-500 uppercase">Float Consumed</span>
                    <span className="text-2xl font-bold">{scenario.float_consumed} days</span>
                 </div>
                 <div className={`bg-white p-4 rounded border shadow-sm flex flex-col ${scenario.project_finish_impact > 0 ? 'border-red-300 bg-red-50' : ''}`}>
                    <span className="text-xs text-gray-500 uppercase">Project Finish Impact</span>
                    <span className={`text-2xl font-bold ${scenario.project_finish_impact > 0 ? 'text-red-600' : 'text-green-600'}`}>+{scenario.project_finish_impact} days</span>
                 </div>
              </div>

              {/* Warnings */}
              {scenario.warnings && scenario.warnings.length > 0 && (
                 <div className="bg-orange-50 border border-orange-200 p-4 rounded shadow-sm">
                    <h3 className="text-sm font-bold text-orange-800 mb-2 flex items-center gap-2"><FiAlertCircle /> Warnings</h3>
                    <ul className="list-disc pl-5 text-sm text-orange-700">
                       {scenario.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                 </div>
              )}

              {/* Proposed Changes Table */}
              <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
                <div className="p-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                   <h3 className="text-sm font-bold text-gray-700 uppercase">Activity Impact (PROPOSED)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Activity</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Current Start</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Current End</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-blue-600 uppercase">Proposed Start</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-blue-600 uppercase">Proposed End</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Delay</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Float After</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200 text-sm">
                      {scenario.proposed_changes.map((rec) => (
                        <tr key={rec.activity_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{rec.activity_name || rec.activity_id}</td>
                          <td className="px-4 py-3 text-gray-500">
                            {rec.current_start ? new Date(rec.current_start).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {rec.current_end ? new Date(rec.current_end).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-4 py-3 font-medium text-blue-600 bg-blue-50">
                            {rec.proposed_start ? new Date(rec.proposed_start).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-4 py-3 font-medium text-blue-600 bg-blue-50">
                            {rec.proposed_end ? new Date(rec.proposed_end).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                              +{rec.delay_days}d
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${rec.float_after <= 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                               {rec.float_after}d
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-xs" title={rec.reason}>
                            {rec.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-100 px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={applying}
            className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={loading || applying || !scenario || scenario.proposed_changes.length === 0}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[#2b7344] hover:bg-[#1e5230] disabled:opacity-50 transition-colors"
          >
            {applying ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Applying...
              </>
            ) : (
              <>
                <FiCheck className="mr-2 -ml-1" />
                Approve & Apply Scenario
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
