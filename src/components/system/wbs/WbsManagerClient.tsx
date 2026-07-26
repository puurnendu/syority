'use client';

import { useState, useEffect, useCallback } from 'react';
import { AddNodeModal } from './AddNodeModal';

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

type EventRow = { id: string; name: string; code: string };

export function WbsManagerClient({
  systemId,
  systemName,
  events,
  canManage,
  canGenerate,
}: {
  systemId: string;
  systemName: string;
  events: EventRow[];
  canManage: boolean;
  canGenerate: boolean;
}) {
  const [eventId, setEventId] = useState(events[0]?.id ?? '');
  const [tree, setTree] = useState<WbsNode[]>([]);
  const [flat, setFlat] = useState<WbsNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [renameNode, setRenameNode] = useState<WbsNode | null>(null);

  const load = useCallback(() => {
    if (!eventId) {
      setTree([]);
      setFlat([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    fetch(`/api/systems/${systemId}/wbs?event_id=${encodeURIComponent(eventId)}`)
      .then((r) => r.json())
      .then((d) => {
        setTree(d.data ?? []);
        setFlat(d.flat ?? []);
      })
      .catch(() => setError('Failed to load WBS'))
      .finally(() => setLoading(false));
  }, [systemId, eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = () => {
    if (!canGenerate || !eventId) return;
    setGenerating(true);
    setError('');
    fetch(`/api/systems/${systemId}/wbs/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: eventId }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          setFlat(d.data ?? []);
          setTree(buildTree(d.data ?? []));
        }
      })
      .catch(() => setError('Generate failed'))
      .finally(() => setGenerating(false));
  };

  function buildTree(nodes: WbsNode[], parentId: string | null = null): WbsNode[] {
    return nodes
      .filter((n) => (n.parent_id ?? null) === parentId)
      .sort((a, b) => a.order - b.order || a.code.localeCompare(b.code))
      .map((n) => ({ ...n, children: buildTree(nodes, n.id) }));
  }

  const exportCsv = () => {
    window.open(`/api/systems/${systemId}/wbs/export?event_id=${encodeURIComponent(eventId)}&format=csv`, '_blank');
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

  const saveRename = async (nodeId: string, code: string, name: string) => {
    const res = await fetch(`/api/wbs/${nodeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim(), name: name.trim() }),
    });
    if (res.ok) {
      setRenameNode(null);
      load();
    } else {
      const j = await res.json();
      setError(j.error || 'Rename failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-4 items-center">
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Event</span>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select event</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.code} – {e.name}</option>
            ))}
          </select>
        </label>
        {canGenerate && (
          <button
            type="button"
            onClick={generate}
            disabled={!eventId || generating}
            className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {generating ? 'Generating…' : 'Auto-generate WBS'}
          </button>
        )}
        {canManage && eventId && (
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            + Add node
          </button>
        )}
        <button
          type="button"
          onClick={exportCsv}
          disabled={!eventId || flat.length === 0}
          className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Export CSV
        </button>
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
              <p className="text-gray-500">No WBS nodes. Select an event and use Auto-generate to create a default structure.</p>
            ) : (
              <ul className="space-y-0">
                {tree.map((node) => (
                  <WbsNodeItem
                    key={node.id}
                    node={node}
                    canManage={canManage}
                    onDelete={deleteNode}
                    onRename={setRenameNode}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <AddNodeModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        eventId={eventId}
        systemId={systemId}
        flatNodes={flat}
        onAdded={load}
      />

      {renameNode && (
        <RenameModal
          node={renameNode}
          onClose={() => setRenameNode(null)}
          onSave={saveRename}
        />
      )}
    </div>
  );
}

function WbsNodeItem({
  node,
  depth = 0,
  canManage,
  onDelete,
  onRename,
}: {
  node: WbsNode;
  depth?: number;
  canManage: boolean;
  onDelete: (id: string) => void;
  onRename: (n: WbsNode) => void;
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
        {node.locked && <span className="text-xs text-amber-600">Locked</span>}
        {canManage && !node.locked && (
          <span className="ml-auto opacity-0 group-hover:opacity-100 flex gap-1">
            <button type="button" onClick={() => onRename(node)} className="text-xs text-blue-600 hover:underline">Rename</button>
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
              onRename={onRename}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function RenameModal({
  node,
  onClose,
  onSave,
}: {
  node: WbsNode;
  onClose: () => void;
  onSave: (id: string, code: string, name: string) => void;
}) {
  const [code, setCode] = useState(node.code);
  const [name, setName] = useState(node.name);
  const [saving, setSaving] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    onSave(node.id, code, name);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Rename node</h3>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
            <input type="text" value={code} onChange={(e) => setCode(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              Save
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
