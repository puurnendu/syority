'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type SiteStandards = {
    id: string;
    name: string;
    pressure_test_standard: string | null;
    hydrotest_multiplier: number | null;
    pneumatic_test_multiplier: number | null;
    torque_standard: string | null;
    test_standard_notes: string | null;
};

const PRESSURE_OPTIONS = [
    'ASME_VIII',
    'PED_2014/68/EU',
    'API_660',
    'TEMA',
    'custom',
];
const TORQUE_OPTIONS = ['ASME_PCC_1', 'EN_1591', 'custom'];

export default function SiteStandardsPage() {
    const params = useParams();
    const siteId = params?.siteId as string;
    const [data, setData] = useState<SiteStandards | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        pressure_test_standard: 'ASME_VIII',
        hydrotest_multiplier: '1.5',
        pneumatic_test_multiplier: '1.1',
        torque_standard: 'ASME_PCC_1',
        test_standard_notes: '',
    });

    useEffect(() => {
        if (!siteId) return;
        fetch(`/api/sites/${siteId}/engineering-standards`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Not found'))))
            .then((d) => {
                setData(d);
                setForm({
                    pressure_test_standard: d.pressure_test_standard ?? 'ASME_VIII',
                    hydrotest_multiplier: String(d.hydrotest_multiplier ?? 1.5),
                    pneumatic_test_multiplier: String(
                        d.pneumatic_test_multiplier ?? 1.1
                    ),
                    torque_standard: d.torque_standard ?? 'ASME_PCC_1',
                    test_standard_notes: d.test_standard_notes ?? '',
                });
            })
            .catch(() => setError('Site not found'))
            .finally(() => setLoading(false));
    }, [siteId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/sites/${siteId}/engineering-standards`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pressure_test_standard: form.pressure_test_standard,
                        hydrotest_multiplier: form.hydrotest_multiplier,
                        pneumatic_test_multiplier:
                            form.pneumatic_test_multiplier,
                        torque_standard: form.torque_standard,
                        test_standard_notes: form.test_standard_notes || null,
                    }),
                }
            );
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error((d as { error?: string }).error ?? 'Failed to save');
            }
            const updated = await res.json();
            setData(updated);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8">Loading…</div>;
    if (error && !data)
        return (
            <div className="p-8">
                <p className="text-red-600">{error}</p>
                <Link href="/settings/hierarchy/sites" className="text-blue-600 underline mt-2 inline-block">
                    ← Back to Sites
                </Link>
            </div>
        );

    return (
        <div className="max-w-2xl space-y-6">
            <div className="flex items-center gap-4">
                <Link
                    href="/settings/hierarchy/sites"
                    className="text-gray-500 hover:text-gray-700 text-sm"
                >
                    ← Sites
                </Link>
                <h1 className="text-2xl font-bold text-gray-900">
                    Engineering Standards — {data?.name ?? 'Site'}
                </h1>
            </div>

            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
                    <span>{error}</span>
                    <button
                        type="button"
                        onClick={() => setError(null)}
                        className="text-red-400 hover:text-red-600"
                    >
                        ✕
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Pressure Test Standard
                    </label>
                    <select
                        value={form.pressure_test_standard}
                        onChange={(e) =>
                            setForm((f) => ({
                                ...f,
                                pressure_test_standard: e.target.value,
                            }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {PRESSURE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                                {opt}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Hydrotest Multiplier (1.0–2.0)
                    </label>
                    <p className="text-xs text-gray-500 mb-1">
                        ASME VIII = 1.5 · PED = 1.43 · API 660 = 1.3
                    </p>
                    <input
                        type="number"
                        min={1}
                        max={2}
                        step={0.01}
                        value={form.hydrotest_multiplier}
                        onChange={(e) =>
                            setForm((f) => ({
                                ...f,
                                hydrotest_multiplier: e.target.value,
                            }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Pneumatic Test Multiplier (1.0–1.5)
                    </label>
                    <input
                        type="number"
                        min={1}
                        max={1.5}
                        step={0.01}
                        value={form.pneumatic_test_multiplier}
                        onChange={(e) =>
                            setForm((f) => ({
                                ...f,
                                pneumatic_test_multiplier: e.target.value,
                            }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Torque Standard
                    </label>
                    <select
                        value={form.torque_standard}
                        onChange={(e) =>
                            setForm((f) => ({
                                ...f,
                                torque_standard: e.target.value,
                            }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {TORQUE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                                {opt}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Notes (client-specific deviations)
                    </label>
                    <textarea
                        value={form.test_standard_notes}
                        onChange={(e) =>
                            setForm((f) => ({
                                ...f,
                                test_standard_notes: e.target.value,
                            }))
                        }
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder="Optional"
                    />
                </div>

                <div className="flex justify-end gap-3">
                    <Link
                        href="/settings/hierarchy/sites"
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                    >
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </form>
        </div>
    );
}
