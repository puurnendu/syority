'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type OnboardingRequest = {
    id: string;
    organization_name: string;
    admin_email: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    notes: string | null;
    created_at: string;
    approved_at: string | null;
    rejected_at: string | null;
};

export function OnboardingListClient({ initialRequests }: { initialRequests: OnboardingRequest[] }) {
    const [requests, setRequests] = useState(initialRequests);
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const router = useRouter();

    const handleAction = async (id: string, status: 'APPROVED' | 'REJECTED') => {
        if (!confirm(`Are you sure you want to ${status.toLowerCase()} this request?`)) return;

        setLoadingId(id);
        try {
            const res = await fetch('/api/admin/onboarding', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status }),
            });

            if (!res.ok) {
                const data = await res.json();
                alert(data.error || `Failed to ${status.toLowerCase()} request.`);
            } else {
                // Update local state
                setRequests(prev => 
                    prev.map(r => r.id === id ? { ...r, status, approved_at: status === 'APPROVED' ? new Date().toISOString() : r.approved_at, rejected_at: status === 'REJECTED' ? new Date().toISOString() : r.rejected_at } : r)
                );
                if (status === 'APPROVED') {
                    router.refresh(); // Refresh to update tenants list if needed
                }
            }
        } catch (err) {
            alert('A network error occurred.');
        } finally {
            setLoadingId(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PENDING': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'APPROVED': return 'bg-green-100 text-green-700 border-green-200';
            case 'REJECTED': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100 italic">
                    <tr>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Organization</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Admin Email</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Status</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Submitted</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Notes</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {requests.map((request) => (
                        <tr key={request.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4">
                                <span className="font-bold text-gray-900">{request.organization_name}</span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                                {request.admin_email}
                            </td>
                            <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadge(request.status)}`}>
                                    {request.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-xs text-gray-400 font-medium">
                                {new Date(request.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate italic">
                                {request.notes || '—'}
                            </td>
                            <td className="px-6 py-4 text-right">
                                {request.status === 'PENDING' && (
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            disabled={loadingId === request.id}
                                            onClick={() => handleAction(request.id, 'APPROVED')}
                                            className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 shadow-sm"
                                        >
                                            {loadingId === request.id ? '...' : 'Approve'}
                                        </button>
                                        <button
                                            disabled={loadingId === request.id}
                                            onClick={() => handleAction(request.id, 'REJECTED')}
                                            className="px-3 py-1.5 bg-white border border-gray-200 text-red-600 text-xs font-bold rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 shadow-sm"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                )}
                                {request.status !== 'PENDING' && (
                                    <span className="text-xs text-gray-400 italic">
                                        {request.status === 'APPROVED' ? `Approved ${new Date(request.approved_at!).toLocaleDateString()}` : `Rejected ${new Date(request.rejected_at!).toLocaleDateString()}`}
                                    </span>
                                )}
                            </td>
                        </tr>
                    ))}
                    {requests.length === 0 && (
                        <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic font-medium">
                                No onboarding requests found.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
