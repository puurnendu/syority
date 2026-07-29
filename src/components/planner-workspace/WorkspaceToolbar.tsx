'use client';

/**
 * M7.5 — WorkspaceToolbar Component
 *
 * Top toolbar with: Event Selector, Search, View Switcher,
 * Group/Sort/Filter controls, Validate button, Layout selector.
 */
import React, { useState } from 'react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import type { WorkspaceView } from '@/stores/useWorkspaceStore';

const VIEWS: { key: WorkspaceView; label: string; icon: string; shortcut: string }[] = [
  { key: 'hierarchy', label: 'Hierarchy', icon: '🏗️', shortcut: 'Alt+1' },
  { key: 'workpacks', label: 'Workpacks', icon: '📦', shortcut: 'Alt+2' },
  { key: 'activities', label: 'Activities', icon: '📝', shortcut: 'Alt+3' },
  { key: 'schedule', label: 'Schedule', icon: '📅', shortcut: 'Alt+4' },
  { key: 'relationships', label: 'Logic', icon: '🔗', shortcut: 'Alt+5' },
  { key: 'resources', label: 'Resources', icon: '👥', shortcut: 'Alt+6' },
  { key: 'contractor_quantities', label: 'Contractor Qty', icon: '🔧', shortcut: 'Alt+7' },
  { key: 'documents', label: 'Documents', icon: '📄', shortcut: 'Alt+8' },
  { key: 'qaqc', label: 'QA/QC', icon: '✅', shortcut: 'Alt+9' },
  { key: 'certificates', label: 'Certificates', icon: '📜', shortcut: 'Alt+0' },
];

export function WorkspaceToolbar({
  onValidate,
  onRefresh,
}: {
  onValidate: () => void;
  onRefresh: () => void;
}) {
  const {
    activeView,
    setActiveView,
    searchQuery,
    setSearchQuery,
    showTree,
    showInspector,
    showBottomPanel,
    toggleTree,
    toggleInspector,
    toggleBottomPanel,
    selectedEventName,
    validationIssues,
    isLoading,
  } = useWorkspaceStore();

  const [showViewMenu, setShowViewMenu] = useState(false);
  const errorCount = validationIssues.filter((i) => i.severity === 'error').length;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white border-b border-gray-700">
      {/* Event context */}
      <div className="flex items-center gap-1.5 text-sm">
        <span className="text-gray-400">🏭</span>
        <span className="font-medium text-gray-200 max-w-[200px] truncate">
          {selectedEventName ?? 'Select Event'}
        </span>
      </div>

      <div className="w-px h-5 bg-gray-700 mx-1" />

      {/* View Switcher */}
      <div className="relative">
        <button
          onClick={() => setShowViewMenu(!showViewMenu)}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-800 rounded hover:bg-gray-700"
        >
          {VIEWS.find((v) => v.key === activeView)?.icon ?? '📊'}
          <span className="hidden md:inline">
            {VIEWS.find((v) => v.key === activeView)?.label ?? 'View'}
          </span>
          <span className="text-gray-500">▾</span>
        </button>

        {showViewMenu && (
          <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 min-w-[200px]">
            {VIEWS.map((view) => (
              <button
                key={view.key}
                onClick={() => {
                  setActiveView(view.key);
                  setShowViewMenu(false);
                }}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-gray-700 text-left
                  ${activeView === view.key ? 'text-blue-400' : 'text-gray-300'}`}
              >
                <span>{view.icon}</span>
                <span className="flex-1">{view.label}</span>
                <span className="text-gray-500 text-[10px]">{view.shortcut}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-gray-700 mx-1" />

      {/* Search */}
      <div className="flex items-center bg-gray-800 rounded px-2">
        <span className="text-gray-500 text-xs">🔍</span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search workpacks, activities..."
          className="bg-transparent text-xs text-gray-200 placeholder-gray-500 outline-none w-48 py-1 px-1.5"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-gray-500 hover:text-gray-300 text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Panel toggles */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          label="Tree"
          icon="🌳"
          active={showTree}
          onClick={toggleTree}
          shortcut="Alt+T"
        />
        <ToolbarButton
          label="Inspector"
          icon="📋"
          active={showInspector}
          onClick={toggleInspector}
          shortcut="Alt+I"
        />
        <ToolbarButton
          label="Bottom"
          icon="📊"
          active={showBottomPanel}
          onClick={toggleBottomPanel}
          shortcut="Alt+B"
        />
      </div>

      <div className="w-px h-5 bg-gray-700 mx-1" />

      {/* Action buttons */}
      <button
        onClick={onValidate}
        className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-600 hover:bg-amber-500 rounded font-medium"
        title="Run Validation (Ctrl+Shift+V)"
      >
        🔍 Validate
        {errorCount > 0 && (
          <span className="px-1 py-0.5 text-[10px] bg-red-500 rounded-full font-bold">
            {errorCount}
          </span>
        )}
      </button>

      <button
        onClick={onRefresh}
        disabled={isLoading}
        className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50"
        title="Refresh data"
      >
        {isLoading ? '⏳' : '🔄'} Refresh
      </button>
    </div>
  );
}

// ── Toolbar Button ────────────────────────────────────────────────────────────

function ToolbarButton({
  label,
  icon,
  active,
  onClick,
  shortcut,
}: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
  shortcut?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={`${label} (${shortcut})`}
      className={`flex items-center gap-1 px-1.5 py-1 text-xs rounded
        ${active ? 'bg-gray-700 text-white' : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'}`}
    >
      <span>{icon}</span>
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}
