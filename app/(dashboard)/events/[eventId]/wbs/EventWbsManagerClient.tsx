'use client';

import { useState, useEffect, useCallback } from 'react';

type WbsNode = {
  id: string;
  code: string;
  name: string;
  type: string;
  order: number;
  locked: boolean;
  parent_id: string | null;
  children?: WbsNode[];
};

export function EventWbsManagerClient({
  eventId,
  eventName,
  canManage,
}: {
  eventId: string;
  eventName: string;
  canManage: boolean;
}) {
  const [tree, setTree] = useState<WbsNode[]>([]);
  const [flat, setFlat] = useState<WbsNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    fetch(`/api/events/${eventId}/wbs`)
      .then((r) => r.json())
      .then((d) => {
        setTree(d.data ?? []);
        setFlat(d.flat ?? []);
      })
      .catch(() => setError('Failed to load WBS'))
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = () => {
    if (!canManage) return;
    setGenerating(true);
    setError('');
    fetch(`/api/events/${eventId}/wbs/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          load();
        }
      })
      .catch(() => setError('Generate failed'))
      .finally(() => setGenerating(false));
  };

  const deleteNode = async (nodeId: string) => {
    if (!canManage) return;
    if (!confirm('Delete this node and all its children?')) return;
    const res = await fetch(`/api/wbs/${nodeId}`, { method: 'DELETE' });
    if (res.ok) load();
    else {
      const j = await res.json();
      setError(j.error || 'Delete failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-4 items-center">
        {canManage && (
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {generating ? 'Generating…' : 'Auto-generate Event WBS'}
          </button>
        )}
      </div>
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">{error}</div>
      )}
      {loading ? (
        <div className="text-gray-500 py-8">Loading WBS…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">WBS Tree</h3>
          </div>
          <div className="p-6">
            {tree.length === 0 ? (
              <p className="text-gray-500">No WBS nodes found. Click Auto-generate to build the top-down tree from the event scope.</p>
            ) : (
              <ul className="space-y-0">
                {tree.map((node) => (
                  <WbsNodeItem
                    key={node.id}
                    node={node}
                    canManage={canManage}
                    onDelete={deleteNode}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WbsNodeItem({
  node,
  depth = 0,
  canManage,
  onDelete,
}: {
  node: WbsNode;
  depth?: number;
  canManage: boolean;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <li className="list-none">
      <div
        className="flex items-center gap-2 py-1.5 hover:bg-gray-50 rounded group"
        style={{ paddingLeft: depth * 20 }}
      >
        {hasChildren ? (
          <button type="button" onClick={() => setExpanded((e) => !e)} className="text-gray-500 w-5 text-left">
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <span className="font-mono text-sm text-gray-800">{node.code}</span>
        <span className="text-sm text-gray-600">{node.name}</span>
        <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">{node.type}</span>
        {canManage && !node.locked && (
          <span className="ml-auto opacity-0 group-hover:opacity-100 flex gap-1">
            <button type="button" onClick={() => onDelete(node.id)} className="text-xs text-red-600 hover:underline">Delete</button>
          </span>
        )}
      </div>
      {expanded && hasChildren && (
        <ul className="space-y-0">
          {node.children!.map((child) => (
            <WbsNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              canManage={canManage}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
