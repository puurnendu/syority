'use client';

/**
 * M12 V1 Phase 2 — GroupingChooser Component
 *
 * Allows users to configure multi-level grouping (e.g. Unit -> System).
 * Includes P6-style preset grouping configurations.
 * All dimensions flow through the unified DimensionRegistry contract.
 */
import React, { useState } from 'react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import type { GroupLevel } from '@/stores/useWorkspaceStore';

const GROUPING_PRESETS: { label: string; icon: string; levels: GroupLevel[] }[] = [
  {
    label: 'Unit → System → Equipment',
    icon: '🏗️',
    levels: [
      { field: 'UNIT', direction: 'asc' },
      { field: 'SYSTEM', direction: 'asc' },
      { field: 'EQUIPMENT', direction: 'asc' },
    ],
  },
  {
    label: 'Contractor → Discipline → Status',
    icon: '👥',
    levels: [
      { field: 'CONTRACTOR', direction: 'asc' },
      { field: 'discipline_code', direction: 'asc' },
      { field: 'status', direction: 'asc' },
    ],
  },
  {
    label: 'Unit → Work Phase',
    icon: '📋',
    levels: [
      { field: 'UNIT', direction: 'asc' },
      { field: 'UDF_WORK_PHASE', direction: 'asc' },
    ],
  },
  {
    label: 'WBS → Discipline',
    icon: '📊',
    levels: [
      { field: 'wbs_code', direction: 'asc' },
      { field: 'discipline_code', direction: 'asc' },
    ],
  },
];

export function GroupingChooser() {
  const [isOpen, setIsOpen] = useState(false);
  const { columns, groupLevels, setGroupLevels } = useWorkspaceStore();

  const handleToggleGroup = (field: string) => {
    const isGrouped = groupLevels.some(g => g.field === field);
    if (isGrouped) {
      setGroupLevels(groupLevels.filter(g => g.field !== field));
    } else {
      setGroupLevels([...groupLevels, { field, direction: 'asc' }]);
    }
  };

  // Only allow grouping by visible columns or specific dimensions
  const groupableColumns = columns.filter(c => c.dimensionCode && c.key !== 'select' && c.key !== 'activity_id');

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-800 rounded hover:bg-gray-700 text-gray-300"
        title="Group By"
      >
        <span>📂 Group By</span>
        {groupLevels.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white rounded-full text-[10px]">
            {groupLevels.length}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 mt-1 w-72 bg-white border border-gray-300 rounded shadow-xl z-50 overflow-hidden flex flex-col max-h-[500px]">
            <div className="px-3 py-2 bg-gray-100 border-b font-medium text-xs text-gray-700 flex justify-between items-center">
              <span>Group By</span>
              {groupLevels.length > 0 && (
                <button onClick={() => setGroupLevels([])} className="text-[10px] text-blue-600 hover:underline">
                  Clear
                </button>
              )}
            </div>
            
            <div className="overflow-y-auto flex-1 p-2">
              {/* Active Groups */}
              <div className="mb-2">
                <div className="text-[10px] uppercase font-bold text-gray-500 mb-1 px-1">
                  Active Groups
                </div>
                {groupLevels.length === 0 ? (
                  <div className="px-2 py-1 text-xs text-gray-400 italic">None selected</div>
                ) : (
                  groupLevels.map((lvl, idx) => (
                    <div key={lvl.field} className="flex items-center justify-between gap-2 px-2 py-1 bg-blue-50 text-blue-800 text-xs rounded mb-1 border border-blue-100">
                      <span>{idx + 1}. {columns.find(c => c.key === lvl.field)?.label || lvl.field}</span>
                      <button onClick={() => handleToggleGroup(lvl.field)} className="text-blue-400 hover:text-blue-600">✕</button>
                    </div>
                  ))
                )}
              </div>

              {/* Presets */}
              <div className="mt-2 mb-2">
                <div className="text-[10px] uppercase font-bold text-gray-500 mb-1 px-1">
                  Presets
                </div>
                <div className="space-y-1">
                  {GROUPING_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        setGroupLevels(preset.levels);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-indigo-50 rounded cursor-pointer text-left text-xs text-gray-700 border border-gray-100 hover:border-indigo-200 transition-colors"
                    >
                      <span>{preset.icon}</span>
                      <span className="font-medium">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Available Fields */}
              <div className="mt-3">
                <div className="text-[10px] uppercase font-bold text-gray-500 mb-1 px-1">
                  Available Fields
                </div>
                {groupableColumns.filter(c => !groupLevels.some(g => g.field === c.key)).map((col) => (
                  <button
                    key={col.key}
                    onClick={() => handleToggleGroup(col.key)}
                    className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer text-left text-xs text-gray-700"
                  >
                    <span>{col.label}</span>
                    <span className="text-gray-400 font-bold text-[14px] leading-none">+</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
