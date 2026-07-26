'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
    open: boolean;
    onClose: () => void;
    workpackId: string;
}

export function ApplyTemplateModal({ open, onClose, workpackId }: Props) {
    const router = useRouter();
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedId, setSelectedId] = useState('');
    const [loading, setLoading] = useState(false);
    const [applying, setApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setLoading(true);
            fetch('/api/admin/templates')
                .then(r => r.json())
                .then(d => {
                    setTemplates(d.data || d);
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        }
    }, [open]);

    const handleApply = async () => {
        if (!selectedId) return;
        setApplying(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/templates/${selectedId}/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workpack_id: workpackId })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to apply template');
            }
            router.refresh();
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to apply template');
        } finally {
            setApplying(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900 italic tracking-tight">Apply Template</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                <div className="p-6">
                    <p className="text-sm text-gray-500 mb-6 font-medium">
                        Select a template to merge activities into this workpack.
                        Existing activities with matching descriptions will be skipped (Smart Merge).
                    </p>

                    {error && (
                        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
                            <span className="flex-shrink-0 mt-0.5">⚠</span>
                            <span>{error}</span>
                            <button onClick={() => setError(null)} className="ml-auto flex-shrink-0 text-red-400 hover:text-red-600">✕</button>
                        </div>
                    )}

                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-50 animate-pulse rounded-xl" />)}
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
                            <div className="text-3xl mb-2">📋</div>
                            <p className="text-sm font-medium text-gray-500">No templates found</p>
                            <p className="text-xs text-gray-400 mt-1">
                                Create templates in{' '}
                                <a href="/settings/templates" className="text-blue-500 underline" target="_blank" rel="noopener noreferrer">
                                    Settings → Templates
                                </a>
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {templates.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setSelectedId(t.id)}
                                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left
                                        ${selectedId === t.id
                                            ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200'
                                            : 'bg-white border-gray-100 hover:border-blue-100'
                                        }`}
                                >
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">{t.name}</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t.equipment_type || 'General'} · {(t._count?.activities ?? t.activities?.length ?? 0)} Activities</p>
                                    </div>
                                    {selectedId === t.id && <span className="text-blue-600 font-bold">✓</span>}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="mt-8 flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 bg-gray-100 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-200 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            disabled={!selectedId || applying}
                            onClick={handleApply}
                            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all shadow-lg
                                ${!selectedId || applying
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                                    : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-blue-500/30'
                                }`}
                        >
                            {applying ? 'Applying…' : 'Apply Template'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
