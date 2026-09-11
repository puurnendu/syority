'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type WorkpackData = {
    id: string;
    title: string;
    code: string | null;
    status: string;
    activities: number;
    hasSnapshot: boolean;
    isEligible: boolean;
};

export default function ExecutionReadinessClient({ workpacks }: { workpacks: WorkpackData[] }) {
    const router = useRouter();
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleIssue = async (id: string) => {
        setLoadingId(id);
        setError(null);
        try {
            const res = await fetch(`/api/workpacks/${id}/workflow`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'issue' })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to issue workpack');
            router.refresh();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoadingId(null);
        }
    };

    return (
        <div>
            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm">
                    {error}
                </div>
            )}
            
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Workpack</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Snapshot</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activities</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {workpacks.map(wp => (
                            <tr key={wp.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm">
                                    <div className="font-medium text-gray-900">{wp.code ?? wp.title}</div>
                                    <div className="text-gray-500 text-xs truncate max-w-xs">{wp.title}</div>
                                </td>
                                <td className="px-4 py-3 text-sm">
                                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                                        {wp.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-sm">
                                    {wp.hasSnapshot ? (
                                        <span className="text-green-600 font-medium text-xs">✓ Frozen</span>
                                    ) : (
                                        <span className="text-red-600 font-medium text-xs">✗ Missing</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700">
                                    {wp.activities}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                    {wp.status === 'issued' || wp.status === 'in_execution' ? (
                                        <span className="text-gray-400 text-xs">Already Issued</span>
                                    ) : (
                                        <button
                                            onClick={() => handleIssue(wp.id)}
                                            disabled={!wp.isEligible || loadingId === wp.id}
                                            className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {loadingId === wp.id ? 'Issuing...' : 'Issue to Field'}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {workpacks.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">
                                    No workpacks are bound to this event's scope.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
