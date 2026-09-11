'use client';

import { ResourceForecastSummary } from '@/core/resources/ResourceForecastService';

export function ResourceForecastChart({ forecast, loading }: { forecast: ResourceForecastSummary[] | null; loading: boolean }) {
  if (loading) {
    return <div className="h-64 bg-gray-100 animate-pulse rounded-xl" />;
  }

  if (!forecast || forecast.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Resource Forecast Overview</h3>
      </div>
      <div className="p-4">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-100 text-gray-500 font-medium text-xs uppercase tracking-wider">
              <th className="pb-3">Resource</th>
              <th className="pb-3 text-right">Demand</th>
              <th className="pb-3 text-right">Capacity</th>
              <th className="pb-3 text-right">Deficit</th>
              <th className="pb-3 text-center">Status</th>
              <th className="pb-3 text-right">Shortage Days</th>
              <th className="pb-3 text-right">Max Consec. Shortage</th>
            </tr>
          </thead>
          <tbody>
            {forecast.map((f, idx) => (
              <tr key={idx} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="py-3 font-medium text-gray-900">
                  {f.resource_type_name}
                  {f.contractor_id && <span className="ml-2 text-xs text-gray-400 font-normal">Cont: {f.contractor_id}</span>}
                </td>
                <td className="py-3 text-right text-gray-600">{f.forecast_demand}</td>
                <td className="py-3 text-right text-gray-600">{f.forecast_capacity}</td>
                <td className={`py-3 text-right font-medium ${f.forecast_deficit > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                  {f.forecast_deficit > 0 ? `-${f.forecast_deficit}` : '0'}
                </td>
                <td className="py-3 text-center">
                  <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold
                    ${f.status === 'CRITICAL' ? 'bg-red-100 text-red-700' : 
                      f.status === 'AT_RISK' ? 'bg-orange-100 text-orange-700' : 
                      f.status === 'WATCH' ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-green-100 text-green-700'}
                  `}>
                    {f.status}
                  </span>
                </td>
                <td className="py-3 text-right text-gray-600">{f.future_shortage_days}</td>
                <td className="py-3 text-right text-gray-600">{f.max_consecutive_shortage_days}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
