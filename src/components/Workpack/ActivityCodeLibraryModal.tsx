'use client';

import { useState, useEffect } from 'react';

export function ActivityCodeLibraryModal({
    workpackId,
    onAdd,
    onClose,
}: {
    workpackId: string;
    organizationId?: string;
    onAdd: (codes: any[]) => Promise<void>;
    onClose: () => void;
}) {
    const [codes, setCodes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [discipline, setDiscipline] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (discipline) params.set('discipline', discipline);
        params.set('limit', '100');

        fetch(`/api/master-data/activity-codes?${params}`)
            .then((r) => (r.ok ? r.json() : { codes: [] }))
            .then((d) => {
                setCodes(d.codes ?? d ?? []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [search, discipline]);

    const disciplines = [
        ...new Set(
            codes
                .map((c) => c.primary_discipline ?? c.discipline ?? '')
                .filter(Boolean)
        ),
    ].sort();

    function toggle(id: string) {
        setSelected((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    function selectAll() {
        setSelected(new Set(codes.map((c) => c.id)));
    }

    async function handleAdd() {
        if (selected.size === 0) return;
        setAdding(true);
        setError(null);
        try {
            const toAdd = codes.filter((c) => selected.has(c.id));
            await onAdd(toAdd);
        } catch (e: any) {
            setError('Failed to add activities: ' + (e?.message ?? 'Unknown'));
        } finally {
            setAdding(false);
        }
    }

    return (
        <>
            <div
                className="fixed inset-0 bg-black/40 z-40"
                onClick={onClose}
            />
            <div
                className="fixed inset-y-4 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
                role="dialog"
                aria-label="Add from Activity Code Library"
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900">
                            📚 Add from Activity Code Library
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Select activity codes to add to this workpack
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-xl leading-none p-1"
                    >
                        ✕
                    </button>
                </div>

                <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search code or description..."
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    />
                    <select
                        value={discipline}
                        onChange={(e) => setDiscipline(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    >
                        <option value="">All disciplines</option>
                        {disciplines.map((d) => (
                            <option key={d} value={d}>
                                {d}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={selectAll}
                        className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                    >
                        Select all
                    </button>
                </div>

                {error && (
                    <div className="mx-6 mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                        <span>⚠</span>
                        <span className="flex-1">{error}</span>
                        <button onClick={() => setError(null)}>✕</button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto px-6 py-3">
                    {loading ? (
                        <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                            Loading activity codes...
                        </div>
                    ) : codes.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 text-sm">
                            No activity codes found.
                            <br />
                            Add codes in Settings → Activity Codes.
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {codes.map((code) => (
                                <label
                                    key={code.id}
                                    className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer border transition-colors ${
                                        selected.has(code.id)
                                            ? 'bg-blue-50 border-blue-300'
                                            : 'bg-white border-gray-100 hover:border-gray-300'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selected.has(code.id)}
                                        onChange={() => toggle(code.id)}
                                        className="mt-0.5 rounded"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                                                {code.code}
                                            </span>
                                            {(code.primary_discipline ??
                                                code.discipline) && (
                                                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                                    {code.primary_discipline ??
                                                        code.discipline}
                                                </span>
                                            )}
                                            {code.default_duration_hours != null && (
                                                <span className="text-xs text-gray-400">
                                                    {code.default_duration_hours}h
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-800 mt-0.5">
                                            {code.description}
                                        </p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex-none flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <span className="text-sm text-gray-500">
                        {selected.size > 0
                            ? `${selected.size} code${selected.size !== 1 ? 's' : ''} selected`
                            : 'No codes selected'}
                    </span>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAdd}
                            disabled={selected.size === 0 || adding}
                            className="px-5 py-2 bg-[#0D2137] text-white text-sm font-medium rounded-xl hover:bg-[#1a3a5c] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {adding
                                ? `Adding ${selected.size}...`
                                : `Add ${selected.size} ${selected.size === 1 ? 'Activity' : 'Activities'}`}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
