'use client';

import React, { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import useSWR from 'swr';
import { FolderTree } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(r => r.json());

// ─── Types ────────────────────────────────────────────────────────────────────

interface Activity {
    id: string;
    wbs_code: string;
    description: string;
    progress_percent: number;
    planned_start: string | null;
    planned_end: string | null;
    actual_start: string | null;
    actual_end: string | null;
}

interface WbsNode {
    id: string;
    code: string;
    name: string;
    parent_id: string | null;
    order: number;
    // Augmented client-side:
    _dotCode?: string;
    children?: WbsNode[];
    // Rollups
    _totalActivities?: number;
    _completedActivities?: number;
    _actualStart?: string | null;
    _actualFinish?: string | null;
    _plannedStart?: string | null;
    _plannedFinish?: string | null;
    _progress?: number;
}

interface Clipboard {
    type: 'copy' | 'cut';
    node: WbsNode; // the root of the subtree
}

interface WbsViewProps {
    projectId: string;
}

// ─── Utility: Build tree from flat list ───────────────────────────────────────

function buildTree(flat: WbsNode[], parentId: string | null = null): WbsNode[] {
    return flat
        .filter(n => n.parent_id === parentId)
        .sort((a, b) => a.order - b.order)
        .map(n => ({ ...n, children: buildTree(flat, n.id) }));
}

/** Assign dotted codes and calculate rollups recursively */
function processTree(nodes: WbsNode[], activities: Activity[], prefix = ''): WbsNode[] {
    return nodes.map((n, i) => {
        const dotCode = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
        
        // Process children first
        const children = n.children ? processTree(n.children, activities, dotCode) : [];
        
        // Find leaf activities directly under this WBS
        const myActivities = activities.filter(a => a.wbs_code === n.id || a.wbs_code === n.code);

        // Roll up from children + my activities
        const totalActs = myActivities.length + children.reduce((s, c) => s + (c._totalActivities ?? 0), 0);
        const compActs  = myActivities.filter(a => a.progress_percent === 100).length + children.reduce((s, c) => s + (c._completedActivities ?? 0), 0);
        
        // Dates
        const allActualStarts = [
            ...myActivities.map(a => a.actual_start).filter(Boolean),
            ...children.map(c => c._actualStart).filter(Boolean)
        ] as string[];
        const actualStart = allActualStarts.length > 0 ? allActualStarts.sort()[0] : null;

        const allActualFinishes = [
            ...myActivities.map(a => a.actual_end).filter(Boolean),
            ...children.map(c => c._actualFinish).filter(Boolean)
        ] as string[];
        const actualFinish = allActualFinishes.length > 0 && compActs === totalActs ? allActualFinishes.sort().reverse()[0] : null;

        // M8.13 GOVERNANCE: PRESENTATION-ONLY — WBS tree rollup for schedule view display
        // Uses simple count average across WBS hierarchy — NOT the authoritative execution progress.
        const totalProgress = myActivities.reduce((s, a) => s + (a.progress_percent || 0), 0) + children.reduce((s, c) => s + ((c._progress ?? 0) * (c._totalActivities ?? 0)), 0);
        const progress = totalActs > 0 ? Math.round(totalProgress / totalActs) : 0;

        return {
            ...n,
            _dotCode: dotCode,
            children,
            _totalActivities: totalActs,
            _completedActivities: compActs,
            _actualStart: actualStart,
            _actualFinish: actualFinish,
            _progress: progress,
        };
    });
}

/** Collect all node IDs in a subtree (including root) */
function subtreeCount(node: WbsNode): number {
    return 1 + (node.children ?? []).reduce((s, c) => s + subtreeCount(c), 0);
}

// ─── Component ────────────────────────────────────────────────────────────────

const WbsView = forwardRef<any, WbsViewProps>(({ projectId }, ref) => {
    const { data, mutate, isLoading, error } = useSWR(
        projectId ? `/api/projects/${projectId}/wbs` : null,
        fetcher,
        { revalidateOnFocus: false }
    );

    const { data: actsData } = useSWR(
        projectId ? `/api/projects/${projectId}/activities` : null,
        fetcher,
        { revalidateOnFocus: false }
    );

    const [selectedId, setSelectedId]     = useState<string | null>(null);
    const [clipboard, setClipboard]       = useState<Clipboard | null>(null);
    const [renamingId, setRenamingId]     = useState<string | null>(null);
    const [renameValue, setRenameValue]   = useState('');
    const [busy, setBusy]                 = useState(false);
    const [toast, setToast]               = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
    const renameRef                        = useRef<HTMLInputElement>(null);

    // ── Derived tree ──────────────────────────────────────────────────────────

    const flat: WbsNode[]    = data?.data ?? [];
    const activities: Activity[] = actsData?.data ?? [];
    const rawTree            = buildTree(flat);
    const tree               = processTree(rawTree, activities);

    const selectedNode = flat.find(n => n.id === selectedId) ?? null;

    // ── Date Formatting ───────────────────────────────────────────────────────
    function fmtDate(s: string | null | undefined): string {
        if (!s) return '-';
        return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase();
    }

    // ── Toast helper ──────────────────────────────────────────────────────────

    function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }

    // ── API helpers ──────────────────────────────────────────────────────────

    const baseUrl   = `/api/projects/${projectId}/wbs`;
    const nodeUrl   = (id: string) => `/api/projects/${projectId}/wbs/${id}`;
    const JSON_HDRS = { 'Content-Type': 'application/json' };

    async function apiPost(parents_id: string | null, name = 'New WBS Node') {
        setBusy(true);
        try {
            const res = await fetch(baseUrl, {
                method: 'POST',
                headers: JSON_HDRS,
                body: JSON.stringify({ name, parent_id: parents_id }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? 'Failed to add node');
            await mutate();
            return json.data;
        } catch (e: any) {
            showToast(e.message, 'err');
            return null;
        } finally {
            setBusy(false);
        }
    }

    async function apiPatch(nodeId: string, payload: Record<string, unknown>) {
        setBusy(true);
        try {
            const res = await fetch(nodeUrl(nodeId), {
                method: 'PATCH',
                headers: JSON_HDRS,
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? 'Failed to update node');
            await mutate();
            return json.data;
        } catch (e: any) {
            showToast(e.message, 'err');
            return null;
        } finally {
            setBusy(false);
        }
    }

    async function apiDelete(nodeId: string) {
        setBusy(true);
        try {
            const res = await fetch(nodeUrl(nodeId), { method: 'DELETE' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? 'Failed to delete node');
            await mutate();
        } catch (e: any) {
            showToast(e.message, 'err');
        } finally {
            setBusy(false);
        }
    }

    // Recursively copy a subtree under a given parent
    async function deepCopy(sourceNode: WbsNode, targetParentId: string | null): Promise<string | null> {
        const created = await apiPost(targetParentId, `${sourceNode.name} (Copy)`);
        if (!created) return null;
        for (const child of sourceNode.children ?? []) {
            await deepCopy(child, created.id);
        }
        return created.id;
    }

    // ── Actions ───────────────────────────────────────────────────────────────

    async function handleAdd() {
        const parentId = selectedNode?.parent_id ?? null;
        const created = await apiPost(parentId);
        if (created) setSelectedId(created.id);
    }

    async function handleDelete() {
        if (!selectedId || !selectedNode) return;
        const count = subtreeCount(selectedNode);
        const msg = count > 1
            ? `Delete "${selectedNode.name}" and all ${count - 1} child node(s)? This cannot be undone.`
            : `Delete "${selectedNode.name}"?`;
        if (!confirm(msg)) return;
        await apiDelete(selectedId);
        setSelectedId(null);
    }

    function handleCopy() {
        if (!selectedNode) return;
        setClipboard({ type: 'copy', node: selectedNode });
        showToast(`"${selectedNode.name}" copied to clipboard`);
    }

    function handleCut() {
        if (!selectedNode) return;
        setClipboard({ type: 'cut', node: selectedNode });
        showToast(`"${selectedNode.name}" cut to clipboard`);
    }

    async function handlePaste() {
        if (!clipboard) return;
        const targetParentId = selectedNode?.id ?? null;

        if (clipboard.type === 'copy') {
            const sourceInTree = findInTree(tree, clipboard.node.id);
            if (!sourceInTree) {
                showToast('Source node no longer exists', 'err');
                return;
            }
            await deepCopy(sourceInTree, targetParentId);
            showToast('Pasted (copy)');
        } else {
            if (clipboard.node.id === targetParentId) {
                showToast('Cannot paste a node inside itself', 'err');
                return;
            }
            await apiPatch(clipboard.node.id, { parent_id: targetParentId });
            setClipboard(null);
            showToast('Pasted (moved)');
        }
    }

    function findInTree(nodes: WbsNode[], id: string): WbsNode | null {
        for (const n of nodes) {
            if (n.id === id) return n;
            const found = findInTree(n.children ?? [], id);
            if (found) return found;
        }
        return null;
    }

    async function handleShift(direction: 'up' | 'down' | 'left' | 'right') {
        if (!selectedId || !selectedNode) return;

        const siblings = flat
            .filter(n => n.parent_id === selectedNode.parent_id)
            .sort((a, b) => a.order - b.order);
        const idx = siblings.findIndex(s => s.id === selectedId);

        if (direction === 'up' && idx > 0) {
            const current = siblings[idx];
            const other = siblings[idx - 1];
            // Swap orders
            await Promise.all([
                apiPatch(current.id, { order: other.order }),
                apiPatch(other.id, { order: current.order }),
            ]);
        } else if (direction === 'down' && idx < siblings.length - 1) {
            const current = siblings[idx];
            const other = siblings[idx + 1];
            // Swap orders
            await Promise.all([
                apiPatch(current.id, { order: other.order }),
                apiPatch(other.id, { order: current.order }),
            ]);
        } else if (direction === 'right' && idx > 0) {
            const newParent = siblings[idx - 1];
            const maxChildOrder = Math.max(0, ...flat.filter(n => n.parent_id === newParent.id).map(n => n.order));
            await apiPatch(selectedNode.id, { parent_id: newParent.id, order: maxChildOrder + 1 });
        } else if (direction === 'left' && selectedNode.parent_id) {
            const currentParent = flat.find(n => n.id === selectedNode.parent_id);
            await apiPatch(selectedNode.id, {
                parent_id: currentParent?.parent_id ?? null,
                order: (currentParent?.order ?? 0) + 0.5,
            });
        }
    }

    useImperativeHandle(ref, () => ({
        handleAdd,
        handleDelete,
        handleCopy,
        handleCut,
        handlePaste,
        handleShift,
        startRename: (id?: string) => {
            const node = id ? flat.find(n => n.id === id) : selectedNode;
            if (node) startRename(node);
        },
        selectedId
    }));

    // ── Keyboard shortcuts ────────────────────────────────────────────────────
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.key === 'Insert')  { e.preventDefault(); handleAdd(); }
            if (e.key === 'Delete')  { e.preventDefault(); handleDelete(); }
            if (e.key === 'F2')      { e.preventDefault(); if (selectedNode) startRename(selectedNode); }
            if (e.ctrlKey) {
                if (e.key === 'c' || e.key === 'C') { e.preventDefault(); handleCopy(); }
                if (e.key === 'x' || e.key === 'X') { e.preventDefault(); handleCut(); }
                if (e.key === 'v' || e.key === 'V') { e.preventDefault(); handlePaste(); }
                if (e.key === 'ArrowUp')    { e.preventDefault(); handleShift('up'); }
                if (e.key === 'ArrowDown')  { e.preventDefault(); handleShift('down'); }
                if (e.key === 'ArrowLeft')  { e.preventDefault(); handleShift('left'); }
                if (e.key === 'ArrowRight') { e.preventDefault(); handleShift('right'); }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [selectedNode, flat]);

    function startRename(node: WbsNode) {
        setRenamingId(node.id);
        setRenameValue(node.name);
        setTimeout(() => renameRef.current?.focus(), 50);
    }

    async function commitRename() {
        if (!renamingId || !renameValue.trim()) { setRenamingId(null); return; }
        await apiPatch(renamingId, { name: renameValue.trim() });
        setRenamingId(null);
    }

    const renderNode = (node: WbsNode, depth = 0): React.ReactNode => {
        const isSelected  = selectedId === node.id;
        const isRenaming  = renamingId === node.id;
        const isCutSource = clipboard?.type === 'cut' && clipboard.node.id === node.id;

        return (
            <React.Fragment key={node.id}>
                <div
                    className={`flex items-center border-b border-gray-100 cursor-pointer group transition-colors text-[12px]
                        ${isSelected
                            ? 'bg-blue-600 text-white'
                            : 'hover:bg-blue-50 text-gray-700'
                        }
                        ${isCutSource ? 'opacity-40 italic' : ''}`}
                    style={{ height: 36 }}
                    onClick={() => setSelectedId(node.id)}
                    onDoubleClick={() => { setSelectedId(node.id); startRename(node); }}
                >
                    <div className="flex-1 flex items-center min-w-0" style={{ paddingLeft: depth * 20 + 8 }}>
                        <div className="w-5 flex-shrink-0 flex items-center justify-center mr-1">
                            {(node.children ?? []).length > 0 ? (
                                <svg className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                </svg>
                            ) : (
                                <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/40' : 'bg-gray-300'}`} />
                            )}
                        </div>
                        <span className={`w-14 flex-shrink-0 font-mono text-[10px] mr-2 ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>
                            {node._dotCode}
                        </span>
                        {isRenaming ? (
                            <input
                                ref={renameRef}
                                className="flex-1 text-[12px] font-semibold bg-white text-gray-900 border border-blue-400 rounded px-1.5 py-0.5 outline-none"
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onBlur={commitRename}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') commitRename();
                                    if (e.key === 'Escape') setRenamingId(null);
                                }}
                            />
                        ) : (
                            <span className={`font-semibold truncate ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                                {node.name}
                            </span>
                        )}
                    </div>
                    <div className="w-24 px-3 text-center border-l border-gray-100/10 flex-shrink-0">{node._totalActivities ?? 0}</div>
                    <div className="w-32 px-3 border-l border-gray-100/10 flex-shrink-0">
                         <div className="flex items-center gap-2">
                            <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isSelected ? 'bg-white/20' : 'bg-gray-200'}`}>
                                <div className={`h-full ${isSelected ? 'bg-white' : 'bg-blue-600'}`} style={{ width: `${node._progress}%` }} />
                            </div>
                            <span className="w-7 text-[10px] font-bold text-right">{node._progress}%</span>
                         </div>
                    </div>
                    <div className="w-32 px-3 text-[10px] font-mono border-l border-gray-100/10 flex-shrink-0 text-center">{fmtDate(node._actualStart)}</div>
                    <div className="w-32 px-3 text-[10px] font-mono border-l border-gray-100/10 flex-shrink-0 text-center">{fmtDate(node._actualFinish)}</div>
                </div>
                {(node.children ?? []).map(child => renderNode(child, depth + 1))}
            </React.Fragment>
        );
    };

    return (
        <div className="flex-1 flex flex-col bg-white overflow-hidden select-none">
            {/* New: Top Management Toolbar for WBS Hierarchy */}
            <div className="bg-gray-50/50 border-b border-gray-200 px-4 py-2 flex items-center justify-between shadow-sm z-10 backdrop-blur-sm">
                <div className="flex items-center gap-1.5">
                    <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 shadow-sm mr-2">
                        <button
                            onClick={handleAdd}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all group relative"
                            title="Add Node (INS)"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={!selectedId}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-all group relative disabled:opacity-20"
                            title="Delete Node (DEL)"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>

                    <div className="w-px h-6 bg-gray-200 mx-1" />

                    <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 shadow-sm mr-2">
                        <button
                            onClick={handleCopy}
                            disabled={!selectedId}
                            className="p-1.5 text-gray-500 hover:bg-gray-50 rounded-lg transition-all group relative disabled:opacity-20"
                            title="Copy (Ctrl+C)"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                            </svg>
                        </button>
                        <button
                            onClick={handleCut}
                            disabled={!selectedId}
                            className="p-1.5 text-gray-500 hover:bg-gray-50 rounded-lg transition-all group relative disabled:opacity-20"
                            title="Cut (Ctrl+X)"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 11-4.243-4.243 3 3 0 014.243 4.243z" />
                            </svg>
                        </button>
                        <button
                            onClick={handlePaste}
                            disabled={!clipboard}
                            className={`p-1.5 rounded-lg transition-all group relative ${clipboard ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-300 opacity-20 cursor-not-allowed'}`}
                            title="Paste (Ctrl+V)"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        </button>
                    </div>

                    <div className="w-px h-6 bg-gray-200 mx-1" />

                    <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
                        <button onClick={() => handleShift('left')} disabled={!selectedId || !selectedNode?.parent_id} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all group relative disabled:opacity-20" title="Outdent (Ctrl+Left)">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                        </button>
                        <button onClick={() => handleShift('right')} disabled={!selectedId} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all group relative disabled:opacity-20" title="Indent (Ctrl+Right)">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                        </button>
                        <div className="w-px h-3.5 bg-gray-100 mx-1" />
                        <button onClick={() => handleShift('up')} disabled={!selectedId} className="p-1.5 text-gray-500 hover:bg-gray-50 rounded-lg transition-all group relative disabled:opacity-20" title="Move Up (Ctrl+Up)">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                        </button>
                        <button onClick={() => handleShift('down')} disabled={!selectedId} className="p-1.5 text-gray-500 hover:bg-gray-50 rounded-lg transition-all group relative disabled:opacity-20" title="Move Down (Ctrl+Down)">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={() => mutate()} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                        <svg className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Refresh
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-100">
                    <div className="flex items-center bg-gray-50 border-b border-gray-200 px-3 py-2 flex-shrink-0 select-none">
                        <div className="flex-1 text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] pl-10">WBS Structure & Title</div>
                        <div className="w-24 px-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">Activities</div>
                        <div className="w-32 px-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">Progress</div>
                        <div className="w-32 px-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">Actual Start</div>
                        <div className="w-32 px-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">Actual Finish</div>
                    </div>
                    <div className="flex-1 overflow-auto bg-white custom-scrollbar">
                        {isLoading ? (
                            <div className="h-full flex flex-col items-center justify-center gap-3">
                                <svg className="w-8 h-8 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                <span className="text-sm font-medium text-gray-400 italic">Syncing hierarchy...</span>
                            </div>
                        ) : flat.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 p-10">
                                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                                    <FolderTree className="w-10 h-10 text-gray-200" />
                                </div>
                                <h3 className="text-gray-900 font-bold text-lg">No WBS Hierarchy</h3>
                                <p className="text-sm text-center max-w-[320px] mt-2 leading-relaxed">Your project structure is empty. Start by adding your first structural node or use the auto-detect feature during import.</p>
                                <button onClick={handleAdd} className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                    Create Root Node
                                </button>
                            </div>
                        ) : (
                            <div className="min-w-fit">{tree.map(node => renderNode(node))}</div>
                        )}
                    </div>
                </div>
            </div>

            {toast && (
                <div className={`fixed bottom-8 right-8 z-[200] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-10 duration-300 ${toast.type === 'ok' ? 'bg-gray-900 text-white' : 'bg-rose-600 text-white'}`}>
                    {toast.type === 'err' && <svg className="w-4 h-4 text-rose-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                    <span className="text-sm font-bold tracking-tight">{toast.msg}</span>
                </div>
            )}
        </div>
    );
});

WbsView.displayName = 'WbsView';

export default WbsView;

// ─── Sub-components ───────────────────────────────────────────────────────────

function SidebarBtn({ icon, label, shortcut, color, onClick, disabled }: any) {
    const COLORS: any = { emerald: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200', red: 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200' };
    return (
        <button onClick={onClick} disabled={disabled} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[12px] font-medium transition-colors ${disabled ? 'opacity-30 cursor-not-allowed' : COLORS[color] || 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">{icon}</svg>
            <span className="flex-1 text-left">{label}</span>
            <span className="text-[9px] opacity-40 font-mono">{shortcut}</span>
        </button>
    );
}

function ArrowBtn({ dir, onClick, disabled }: any) {
    const paths: any = { up: 'M5 15l7-7 7 7', down: 'M19 9l-7 7-7-7', left: 'M15 19l-7-7 7-7', right: 'M9 5l7 7-7 7' };
    return (
        <button onClick={onClick} disabled={disabled} className={`p-2 border rounded-lg flex items-center justify-center transition-all ${disabled ? 'opacity-20 cursor-not-allowed' : 'bg-white text-gray-600 hover:bg-blue-50 hover:text-blue-600'}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d={paths[dir]} /></svg>
        </button>
    );
}
