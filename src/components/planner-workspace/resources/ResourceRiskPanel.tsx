'use client';

import { ResourceRisk } from '@/core/resources/ResourceRiskService';

export function ResourceRiskPanel({ risks, loading }: { risks: ResourceRisk[] | null; loading: boolean }) {
  if (loading) {
    return <div className="h-48 bg-gray-100 animate-pulse rounded-xl" />;
  }

  if (!risks || risks.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm p-8 text-center text-gray-500">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Early Warnings & Risks</h3>
        <p className="text-sm">No significant resource risks detected.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <span>Early Warnings & Risks</span>
          <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-bold">{risks.length}</span>
        </h3>
      </div>
      <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
        {risks.map((risk) => (
          <div key={risk.risk_id} className="p-4 hover:bg-gray-50">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 text-xs font-bold rounded-sm
                  ${risk.severity === 'CRITICAL' ? 'bg-red-500 text-white' : 
                    risk.severity === 'HIGH' ? 'bg-orange-500 text-white' : 
                    risk.severity === 'MEDIUM' ? 'bg-yellow-400 text-yellow-900' : 
                    'bg-blue-100 text-blue-700'}
                `}>
                  {risk.severity}
                </span>
                <span className="font-semibold text-gray-900">{risk.resource_type_name}</span>
                <span className="text-sm text-gray-500">{risk.date}</span>
              </div>
              <span className="text-xs text-gray-400 font-mono">Score: {risk.score}</span>
            </div>
            
            <p className="text-sm text-gray-700 mb-3">{risk.reason}</p>
            
            <div className="bg-blue-50 border border-blue-100 rounded p-3">
              <p className="text-sm font-medium text-blue-900 mb-1">Recommended Action</p>
              <p className="text-sm text-blue-800">{risk.recommended_action}</p>
            </div>
            
            {risk.project_finish_impact > 0 && (
              <p className="mt-2 text-xs font-semibold text-red-600 flex items-center gap-1">
                <span>⚠</span>
                Potential Project Delay Impact: ~{risk.project_finish_impact} days
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
