'use client';
import { useState, useEffect } from 'react';

export default function ConstraintHeatmap() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/constraint-heatmap')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg animate-pulse text-gray-400">Loading Heatmap...</div>;
  if (data.length === 0) return <div className="h-48 flex items-center justify-center bg-gray-50 rounded-lg text-gray-400">No open constraints for heatmap</div>;

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-6 flex items-center gap-2">
        <span className="text-lg">🔥</span> Constraint Heatmap by Area
      </h3>
      
      <div className="space-y-4">
        {data.map((item) => (
          <div key={item.area} className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-gray-700">{item.area}</span>
              <span className="text-gray-400">{item.total} total</span>
            </div>
            <div className="flex h-6 rounded-lg overflow-hidden border border-gray-100 shadow-sm">
              {item.critical > 0 && (
                <div 
                  className="bg-red-600 flex items-center justify-center text-[10px] text-white font-bold" 
                  style={{ width: `${(item.critical / item.total) * 100}%` }}
                  title={`${item.critical} Critical`}
                >
                  {item.critical}
                </div>
              )}
              {item.high > 0 && (
                <div 
                  className="bg-orange-500 flex items-center justify-center text-[10px] text-white font-bold" 
                  style={{ width: `${(item.high / item.total) * 100}%` }}
                  title={`${item.high} High`}
                >
                   {item.high}
                </div>
              )}
              {item.medium > 0 && (
                <div 
                  className="bg-yellow-400 flex items-center justify-center text-[10px] text-gray-800 font-bold" 
                  style={{ width: `${(item.medium / item.total) * 100}%` }}
                  title={`${item.medium} Medium`}
                >
                   {item.medium}
                </div>
              )}
              {item.low > 0 && (
                <div 
                  className="bg-gray-200 flex items-center justify-center text-[10px] text-gray-600 font-bold" 
                  style={{ width: `${(item.low / item.total) * 100}%` }}
                  title={`${item.low} Low`}
                >
                   {item.low}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-4 text-[10px] text-gray-400 font-medium">
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600"></span> Critical</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> High</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400"></span> Medium</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200"></span> Low</div>
      </div>
    </div>
  );
}
