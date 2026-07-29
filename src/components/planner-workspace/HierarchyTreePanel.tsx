'use client';

/**
 * M7.5 — HierarchyTreePanel Component
 *
 * Left panel showing: Shutdown → Unit → System → Asset → Workpack tree.
 * Clicking a node filters the Workpack Grid and Activity Grid.
 * Shows rollup badges (workpack count, duration) on each node.
 */
import React, { useState } from 'react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import type { TreeNode } from '@/core/planner-workspace';

const ICONS: Record<string, string> = {
  site: '🏭',
  plant: '🏗️',
  area: '📍',
  unit: '⚙️',
  system: '🔧',
  asset: '📦',
  workpack: '📋',
};

export function HierarchyTreePanel() {
  const {
    treeNodes,
    treeExpandedIds,
    selectedTreeNodeId,
    toggleTreeNode,
    selectTreeNode,
    selectedEventName,
  } = useWorkspaceStore();

  const [searchQuery, setSearchQuery] = useState('');

  const filteredNodes = searchQuery
    ? filterTree(treeNodes, searchQuery.toLowerCase())
    : treeNodes;

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Hierarchy
        </div>
        {selectedEventName && (
          <div className="text-sm font-medium text-gray-800 truncate mt-0.5">
            🏭 {selectedEventName}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 border-b border-gray-200">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search..."
          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none"
        />
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-auto px-1 py-1">
        {filteredNodes.length === 0 ? (
          <div className="text-center text-gray-400 text-xs py-8">
            {treeNodes.length === 0 ? 'Select an event to load hierarchy' : 'No matches'}
          </div>
        ) : (
          filteredNodes.map((node) => (
            <TreeNodeItem
              key={node.id}
              node={node}
              level={0}
              expandedIds={treeExpandedIds}
              selectedId={selectedTreeNodeId}
              onToggle={toggleTreeNode}
              onSelect={selectTreeNode}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Tree Node ─────────────────────────────────────────────────────────────────

function TreeNodeItem({
  node,
  level,
  expandedIds,
  selectedId,
  onToggle,
  onSelect,
}: {
  node: TreeNode;
  level: number;
  expandedIds: Set<string>;
  selectedId: string | null;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const hasChildren = node.children && node.children.length > 0;
  const icon = ICONS[node.type] ?? '📄';

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-1 py-0.5 rounded cursor-pointer text-xs
          ${isSelected ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100 text-gray-700'}`}
        style={{ paddingLeft: level * 16 + 4 }}
        onClick={() => {
          onSelect(node.id);
          if (hasChildren) onToggle(node.id);
        }}
      >
        {/* Expand/collapse arrow */}
        <span className="w-3 text-center text-gray-400">
          {hasChildren ? (isExpanded ? '▼' : '▶') : ' '}
        </span>

        {/* Icon */}
        <span className="text-xs">{icon}</span>

        {/* Code + Name */}
        <span className="font-medium truncate">{node.code}</span>
        <span className="text-gray-500 truncate hidden xl:inline">
          {node.name !== node.code ? ` — ${node.name}` : ''}
        </span>

        {/* Rollup badges */}
        {node.rollup && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-gray-400 flex-shrink-0">
            {node.rollup.workpackCount > 0 && (
              <span title="Workpacks">{node.rollup.workpackCount}wp</span>
            )}
            {node.rollup.totalDurationHrs > 0 && (
              <span title="Duration">{node.rollup.totalDurationHrs}h</span>
            )}
          </span>
        )}
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              level={level + 1}
              expandedIds={expandedIds}
              selectedId={selectedId}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Filter helper ─────────────────────────────────────────────────────────────

function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  return nodes
    .map((node) => {
      const matches =
        node.code.toLowerCase().includes(query) ||
        node.name.toLowerCase().includes(query);
      const filteredChildren = node.children ? filterTree(node.children, query) : [];

      if (matches || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren.length > 0 ? filteredChildren : node.children };
      }
      return null;
    })
    .filter(Boolean) as TreeNode[];
}
