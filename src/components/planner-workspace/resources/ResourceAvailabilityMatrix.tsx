'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ResourceCapacity, ResourceTypeSummary, ContractorSummary, ShiftDefinition } from './types';
import { ResourceCapacityEditor } from './ResourceCapacityEditor';

export function ResourceAvailabilityMatrix({
  eventId,
  resourceTypes,
  contractors,
  shifts,
  startDate,
  endDate,
  onCapacityChanged
}: {
  eventId: string;
  resourceTypes: ResourceTypeSummary[];
  contractors: ContractorSummary[];
  shifts: ShiftDefinition[];
  startDate: string;
  endDate: string;
  onCapacityChanged: () => void;
}) {
  const [capacities, setCapacities] = useState<ResourceCapacity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedCell, setSelectedCell] = useState<{ date: string, resourceTypeId: string, resourceTypeName: string } | null>(null);

  const fetchCapacity = useCallback(async () => {
    if (!eventId || !startDate || !endDate) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ startDate, endDate });
      const res = await fetch(`/api/events/${eventId}/resource-capacity?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch capacity data');
      const data = await res.json();
      setCapacities(data.data || data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [eventId, startDate, endDate]);

  useEffect(() => {
    fetchCapacity();
  }, [fetchCapacity]);

  // Generate Date Range Array
  const dates = useMemo(() => {
    const dts: string[] = [];
    if (!startDate || !endDate) return dts;
    const cur = new Date(startDate);
    const end = new Date(endDate);
    while (cur <= end) {
      dts.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    return dts;
  }, [startDate, endDate]);

  // Aggregate Capacity per ResourceType per Date (sum of all shifts/contractors)
  const matrixData = useMemo(() => {
    const map = new Map<string, number>();
    capacities.forEach(c => {
      if (c.target_date && c.resource_type_id) {
        // Date format from backend might contain time, slice it
        const dateStr = c.target_date.slice(0, 10);
        const key = `${c.resource_type_id}_${dateStr}`;
        map.set(key, (map.get(key) || 0) + Number(c.capacity_limit));
      }
    });
    return map;
  }, [capacities]);

  if (loading && capacities.length === 0) {
    return <div className="p-4 text-sm text-gray-500">Loading availability matrix...</div>;
  }
  if (error) {
    return <div className="p-4 text-sm text-red-600">Error: {error}</div>;
  }

  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead className="sticky top-0 bg-gray-100 shadow-sm z-10">
            <tr>
              <th className="p-2 border-b border-r border-gray-200 text-xs text-gray-700 bg-gray-100 sticky left-0 z-20 min-w-[200px]">
                Resource Type
              </th>
              {dates.map(d => {
                const dateObj = new Date(d);
                return (
                  <th key={d} className="p-2 border-b border-r border-gray-200 text-xs font-semibold text-gray-600 text-center min-w-[80px]">
                    {dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-white text-sm">
            {resourceTypes.length === 0 ? (
              <tr>
                <td colSpan={dates.length + 1} className="p-4 text-center text-gray-500">
                  No resource types found.
                </td>
              </tr>
            ) : (
              resourceTypes.map(rt => (
                <tr key={rt.id} className="hover:bg-gray-50">
                  <td className="p-2 border-b border-r border-gray-200 font-medium text-gray-800 sticky left-0 bg-white z-10">
                    {rt.name}
                  </td>
                  {dates.map(d => {
                    const key = `${rt.id}_${d}`;
                    const cap = matrixData.get(key) || 0;
                    return (
                      <td 
                        key={d} 
                        className={`p-2 border-b border-r border-gray-100 text-center cursor-pointer hover:bg-blue-50 transition-colors ${cap > 0 ? 'text-gray-800 font-medium' : 'text-gray-400'}`}
                        onClick={() => setSelectedCell({ date: d, resourceTypeId: rt.id, resourceTypeName: rt.name })}
                      >
                        {cap > 0 ? cap : '-'}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedCell && (
        <ResourceCapacityEditor
          eventId={eventId}
          date={selectedCell.date}
          resourceTypeId={selectedCell.resourceTypeId}
          resourceTypeName={selectedCell.resourceTypeName}
          contractors={contractors}
          shifts={shifts}
          existingCapacities={capacities.filter(c => c.target_date?.startsWith(selectedCell.date) && c.resource_type_id === selectedCell.resourceTypeId)}
          onClose={() => setSelectedCell(null)}
          onSaved={() => {
            fetchCapacity();
            onCapacityChanged();
          }}
        />
      )}
    </div>
  );
}
