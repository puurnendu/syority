'use client';

import { useState, useEffect } from 'react';

export type OverviewNozzle = {
    id: string;
    mark: string;
    location: string;
    size: string | null;
    rating: string | null;
    flange_type: string | null;
    jointNo: string;
    blindNo: string;
};

interface SyncOverviewJointsModalProps {
    open: boolean;
    onClose: () => void;
    workpackId: string;
    onSynced: () => void;
}

export function SyncOverviewJointsModal({ open, onClose, workpackId, onSynced }: SyncOverviewJointsModalProps) {
    const [nozzles, setNozzles] = useState<OverviewNozzle[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    
    // Track selected items by id
    const [selectedJoints, setSelectedJoints] = useState<Set<string>>(new Set());
    const [selectedBlinds, setSelectedBlinds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!open) return;
        
        async function fetchNozzles() {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/workpacks/${workpackId}/joints/sync-from-overview`);
                if (!res.ok) throw new Error('Failed to fetch overview data');
                const data = await res.json();
                setNozzles(data.nozzles || []);
                
                // Select all by default for joints, none for blinds
                const allIds = new Set((data.nozzles || []).map((n: OverviewNozzle) => n.id));
                setSelectedJoints(allIds as Set<string>);
                setSelectedBlinds(new Set());
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        
        fetchNozzles();
    }, [open, workpackId]);

    const handleToggleJoint = (id: string) => {
        const next = new Set(selectedJoints);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedJoints(next);
    };

    const handleToggleBlind = (id: string) => {
        const next = new Set(selectedBlinds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedBlinds(next);
    };

    const handleSync = async () => {
        setSaving(true);
        setError(null);
        try {
            const jointsToCreate = nozzles.filter(n => selectedJoints.has(n.id));
            const blindsToCreate = nozzles.filter(n => selectedBlinds.has(n.id));

            if (jointsToCreate.length === 0 && blindsToCreate.length === 0) {
                onClose();
                return;
            }

            const res = await fetch(`/api/workpacks/${workpackId}/joints/sync-from-overview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ joints: jointsToCreate, blinds: blindsToCreate }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to sync joints/blinds');
            }

            onSynced();
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
            <div className="relative bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Sync from Overview</h3>
                        <p className="text-xs text-gray-500 mt-1">Select the extracted nozzles you wish to import into the Joint and Blind registers.</p>
                    </div>
                    <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">✕</button>
                </div>
                
                <div className="p-4 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="py-12 flex justify-center items-center">
                            <span className="text-sm text-gray-500">Loading overview data...</span>
                        </div>
                    ) : error ? (
                        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
                            {error}
                        </div>
                    ) : nozzles.length === 0 ? (
                        <div className="py-12 flex flex-col justify-center items-center text-center">
                            <span className="text-4xl pr-4 pl-4 pb-2 pt-2 mb-2">🔍</span>
                            <span className="text-sm font-medium text-gray-900">No extracted nozzles found</span>
                            <span className="text-xs text-gray-500 mt-1">Extract Technical Data in the Overview tab first.</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto border border-gray-200 rounded-lg">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                                    <tr>
                                        <th className="px-4 py-3 font-medium border-b w-10 text-center">Import as Joint</th>
                                        <th className="px-4 py-3 font-medium border-b w-10 text-center">Import as Blind</th>
                                        <th className="px-4 py-3 font-medium border-b">Marking</th>
                                        <th className="px-4 py-3 font-medium border-b">Location / Service</th>
                                        <th className="px-4 py-3 font-medium border-b">Size</th>
                                        <th className="px-4 py-3 font-medium border-b">Rating</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {nozzles.map((nozzle) => (
                                        <tr key={nozzle.id} className="border-b last:border-b-0 hover:bg-gray-50">
                                            <td className="px-4 py-3 text-center border-r">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedJoints.has(nozzle.id)}
                                                    onChange={() => handleToggleJoint(nozzle.id)}
                                                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-center border-r">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedBlinds.has(nozzle.id)}
                                                    onChange={() => handleToggleBlind(nozzle.id)}
                                                    className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-4 py-3 font-mono font-medium text-gray-900">{nozzle.mark}</td>
                                            <td className="px-4 py-3 text-gray-700">{nozzle.location}</td>
                                            <td className="px-4 py-3 text-gray-500">{nozzle.size || '—'}</td>
                                            <td className="px-4 py-3 text-gray-500">{nozzle.rating || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                
                <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
                    <span className="text-xs text-gray-500">
                        Selected: <span className="font-semibold text-blue-600">{selectedJoints.size} joints</span>, <span className="font-semibold text-indigo-600">{selectedBlinds.size} blinds</span>
                    </span>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSync}
                            disabled={loading || saving || (selectedJoints.size === 0 && selectedBlinds.size === 0)}
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            {saving ? 'Syncing...' : 'Sync Selected to Registers →'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
