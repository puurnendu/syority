'use client';

import { useState, useEffect } from 'react';
import { GenerateJointsModal } from '@/components/Workpack/Joints/GenerateJointsModal';
import { SyncOverviewJointsModal } from '@/components/Workpack/Joints/SyncOverviewJointsModal';
import type { ExtractedJoint } from '@/lib/ai/jointExtraction';

type DocOption = { id: string; title: string; original_filename?: string };

interface JointsBlindTabProps {
    workpackId: string;
    topContent: React.ReactNode;
    bottomContent: React.ReactNode;
    jointCount?: number;
}

export function JointsBlindTab({
    workpackId,
    topContent,
    bottomContent,
    jointCount = 0,
}: JointsBlindTabProps) {
    const [splitPct, setSplitPct] = useState(50);
    const [dragging, setDragging] = useState(false);
    const [genModalMode, setGenModalMode] = useState<'joint' | 'blind' | null>(null);
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [genSuccess, setGenSuccess] = useState<string | null>(null);
    const [attachedDocuments, setAttachedDocuments] = useState<DocOption[]>([]);

    useEffect(() => {
        const handler = () => setGenModalMode('joint');
        window.addEventListener('trigger-regen-joints', handler);
        return () => window.removeEventListener('trigger-regen-joints', handler);
    }, []);

    useEffect(() => {
        async function loadDocuments() {
            try {
                const res = await fetch(`/api/workpacks/${workpackId}/documents`);
                if (res.ok) {
                    const docs = await res.json();
                    setAttachedDocuments(
                        docs.map((d: { id: string; title?: string; original_filename?: string }) => ({
                            id: d.id,
                            title: d.title || d.original_filename || d.id,
                            original_filename: d.original_filename,
                        }))
                    );
                }
            } catch (e) {
                console.error('[JointsBlindTab] Failed to load documents:', e);
            }
        }
        if (workpackId) loadDocuments();
    }, [workpackId]);

    function handleDividerMouseDown(e: React.MouseEvent<HTMLDivElement>) {
        e.preventDefault();
        setDragging(true);
        const container = (e.currentTarget as HTMLElement).closest(
            '[data-split-container]'
        ) as HTMLElement;
        if (!container) return;

        const onMove = (ev: MouseEvent) => {
            const rect = container.getBoundingClientRect();
            const pct = ((ev.clientY - rect.top) / rect.height) * 100;
            setSplitPct(Math.min(80, Math.max(20, pct)));
        };
        const onUp = () => {
            setDragging(false);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }

    const aiStubMessage =
        'Upload drawings to AI Create to auto-generate the joint/blind register. Available in Phase 3.';

    return (
        <div
            data-split-container
            className="flex flex-col h-full min-h-[400px]"
            style={{ userSelect: dragging ? 'none' : 'auto' }}
        >
            <div
                className="overflow-y-auto flex-shrink-0"
                style={{ height: `${splitPct}%` }}
            >
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <h2 className="text-sm font-semibold text-gray-800">
                        Joint Integrity Register
                    </h2>
                    <button
                        type="button"
                        onClick={() => setGenModalMode('joint')}
                        title={aiStubMessage}
                        className="text-xs px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
                    >
                        Generate from Drawing
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowSyncModal(true)}
                        className="text-xs px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-full hover:bg-indigo-100 flex items-center gap-1 transition-colors"
                        title="Sync generic nozzle data extracted from Technical Data Overview"
                    >
                        <span>🔄</span> Sync from Overview
                    </button>
                    {jointCount > 0 && (
                        <button
                            type="button"
                            onClick={() => setGenModalMode('joint')}
                            className="px-3 py-1.5 text-xs border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 flex items-center gap-1.5 transition-colors"
                            title="Re-run AI generation — existing joints will be replaced"
                        >
                            ↻ Regenerate from Spec
                        </button>
                    )}
                    {genSuccess && (
                        <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full animate-in fade-in slide-in-from-top-1">
                            {genSuccess}
                        </span>
                    )}
                </div>
                <div className="min-h-0">{topContent}</div>
            </div>

            <div
                className="flex-none h-3 flex items-center justify-center cursor-row-resize group flex-shrink-0"
                onMouseDown={handleDividerMouseDown}
            >
                <div className="w-16 h-1 bg-gray-200 group-hover:bg-blue-400 rounded-full transition-colors" />
            </div>

            <div
                className="overflow-y-auto flex-1 min-h-0"
                style={{ height: `${100 - splitPct}%` }}
            >
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <h2 className="text-sm font-semibold text-gray-800">
                        Blind Register
                    </h2>
                    <button
                        type="button"
                        onClick={() => setGenModalMode('blind')}
                        title={aiStubMessage}
                        className="text-xs px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
                    >
                        Generate from Drawing
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowSyncModal(true)}
                        className="text-xs px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-full hover:bg-indigo-100 flex items-center gap-1 transition-colors"
                        title="Sync generic nozzle data extracted from Technical Data Overview"
                    >
                        <span>🔄</span> Sync from Overview
                    </button>
                </div>
                <div className="min-h-0">{bottomContent}</div>
            </div>

            <GenerateJointsModal
                open={genModalMode !== null}
                onClose={() => setGenModalMode(null)}
                workpackId={workpackId}
                mode={genModalMode || 'joint'}
                attachedDocuments={attachedDocuments}
                onGenerated={(data) => {
                    const typeLabel = genModalMode === 'blind' ? 'blinds' : 'joints';
                    setGenSuccess(`AI generated ${data.length} ${typeLabel}.`);
                    setTimeout(() => setGenSuccess(null), 5000);
                    
                    if (genModalMode === 'blind') {
                        window.dispatchEvent(new CustomEvent('blinds-refreshed'));
                    } else {
                        window.dispatchEvent(new CustomEvent('joints-refreshed'));
                    }
                }}
            />

            <SyncOverviewJointsModal
                open={showSyncModal}
                onClose={() => setShowSyncModal(false)}
                workpackId={workpackId}
                onSynced={() => {
                    setGenSuccess(`Successfully synced data from Technical Overview.`);
                    setTimeout(() => setGenSuccess(null), 5000);
                    window.dispatchEvent(new CustomEvent('joints-refreshed'));
                    window.dispatchEvent(new CustomEvent('blinds-refreshed'));
                }}
            />
        </div>
    );
}
