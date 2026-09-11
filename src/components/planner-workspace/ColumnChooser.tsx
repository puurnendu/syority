'use client';

/**
 * M12 V1 Phase 2 — ColumnChooser Component
 *
 * Allows users to toggle visibility of grid columns based on the DimensionRegistry.
 */
import React, { useState } from 'react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

export function ColumnChooser() {
  const [isOpen, setIsOpen] = useState(false);
  const { columns, toggleColumnVisibility } = useWorkspaceStore();

  // Group columns by type for easier selection
  const systemColumns = columns.filter((c) => !c.isUdf && c.key !== 'select');
  const udfColumns = columns.filter((c) => c.isUdf);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-800 rounded hover:bg-gray-700 text-gray-300"
        title="Columns"
      >
        <span>⚙️ Columns</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-gray-300 rounded shadow-xl z-50 overflow-hidden flex flex-col max-h-[400px]">
            <div className="px-3 py-2 bg-gray-100 border-b font-medium text-xs text-gray-700">
              Show/Hide Columns
            </div>
            
            <div className="overflow-y-auto flex-1 p-2">
              {/* System Columns */}
              <div className="mb-2">
                <div className="text-[10px] uppercase font-bold text-gray-500 mb-1 px-1">
                  System Columns
                </div>
                {systemColumns.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={col.visible}
                      onChange={() => toggleColumnVisibility(col.key)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                      disabled={col.frozen}
                    />
                    <span className="text-xs text-gray-700 select-none">
                      {col.label}
                    </span>
                  </label>
                ))}
              </div>

              {/* UDF Columns */}
              {udfColumns.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase font-bold text-gray-500 mb-1 px-1">
                    Custom Fields (UDF)
                  </div>
                  {udfColumns.map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={col.visible}
                        onChange={() => toggleColumnVisibility(col.key)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-700 select-none">
                        {col.label}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
