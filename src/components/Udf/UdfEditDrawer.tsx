'use client';

import { useState, useEffect } from 'react';

export type UdfDefinition = {
    id: string;
    code: string;
    name: string;
    type: string;
    is_mandatory?: boolean | null;
    sort_order?: number | null;
    is_active?: boolean | null;
    options?: Array<{ id: string; code_value?: string | null; value: string; label: string }>;
};

type Props = {
    open: boolean;
    onClose: () => void;
    definition: UdfDefinition | null;
    hasValues: boolean;
    onSaved: () => void;
};

const CODE_REGEX = /^[a-z][a-z0-9_]*$/;
const TYPES = [
    { value: 'text', label: 'Text — free text input' },
    { value: 'number', label: 'Number — numeric input' },
    { value: 'select', label: 'Select — dropdown (options defined after creation)' },
];

export function UdfEditDrawer({ open, onClose, definition, hasValues, onSaved }: Props) {
    const isCreate = !definition?.id;
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [type, setType] = useState('text');
    const [isMandatory, setIsMandatory] = useState(false);
    const [sortOrder, setSortOrder] = useState(0);
    const [isActive, setIsActive] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (definition) {
            setCode(definition.code);
            setName(definition.name);
            setType(definition.type);
            setIsMandatory(definition.is_mandatory ?? false);
            setSortOrder(definition.sort_order ?? 0);
            setIsActive(definition.is_active !== false);
        } else {
            setCode('');
            setName('');
            setType('text');
            setIsMandatory(false);
            setSortOrder(0);
            setIsActive(true);
        }
        setError('');
    }, [definition, open]);

    const codeLocked = hasValues || !isCreate;
    const typeLocked = !isCreate;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const codeNorm = code.trim().toLowerCase().replace(/\s+/g, '_');
        if (!CODE_REGEX.test(codeNorm)) {
            setError('Code must be lowercase letters, numbers, underscores only (e.g. my_udf)');
            return;
        }
        if (!name.trim()) {
            setError('Display name is required');
            return;
        }
        setSaving(true);
        try {
            const base = '/api/master-data/udf-definitions';
            if (isCreate) {
                const res = await fetch(base, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code: codeNorm,
                        name: name.trim(),
                        type,
                        is_mandatory: isMandatory,
                        sort_order: sortOrder,
                        is_active: isActive,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || data.message || 'Create failed');
                onSaved();
                onClose();
            } else {
                const res = await fetch(`${base}/${definition!.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code: codeLocked ? undefined : codeNorm,
                        name: name.trim(),
                        is_mandatory: isMandatory,
                        sort_order: sortOrder,
                        is_active: isActive,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || data.message || 'Update failed');
                onSaved();
                onClose();
            }
        } catch (err: any) {
            setError(err.message ?? 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
            <div className="fixed right-0 top-0 bottom-0 z-50 w-[480px] max-w-[100vw] bg-white shadow-2xl flex flex-col">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">{isCreate ? 'Add UDF' : 'Edit UDF'}</h2>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                </div>
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>}

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Code *</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/[^a-z0-9_]/gi, '_').toLowerCase())}
                                readOnly={codeLocked}
                                className={`w-full px-3 py-2 border rounded-lg text-sm font-mono ${codeLocked ? 'bg-gray-100 text-gray-600' : 'border-gray-300'}`}
                                placeholder="e.g. discipline"
                            />
                            {codeLocked && <span className="text-amber-600" title="Code cannot be changed — activities are using this UDF">🔒</span>}
                        </div>
                        <p className="mt-1 text-xs text-gray-400">Used internally. Cannot change after use.</p>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Display Name *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="e.g. Discipline"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Data Type *</label>
                        <div className="flex items-center gap-2">
                            {typeLocked ? (
                                <span className={`inline-flex px-2 py-1 rounded text-sm font-medium ${
                                    type === 'select' ? 'bg-orange-100 text-orange-800' : type === 'number' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                    {type}
                                </span>
                            ) : (
                                <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                                    {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            )}
                            {typeLocked && <span className="text-amber-600" title="Data type cannot be changed after creation">🔒</span>}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="mandatory" checked={isMandatory} onChange={(e) => setIsMandatory(e.target.checked)} className="rounded border-gray-300 text-blue-600" />
                        <label htmlFor="mandatory" className="text-sm text-gray-700">Mandatory (activity cannot be saved without a value)</label>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Sort Order</label>
                        <input type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value) || 0)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                        <p className="mt-1 text-xs text-gray-400">Lower = further left in Activities grid</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="active" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-gray-300 text-blue-600" />
                        <label htmlFor="active" className="text-sm text-gray-700">Active (inactive UDFs hidden from grid)</label>
                    </div>

                    <div className="pt-4 mt-4 border-t border-gray-200 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium">Cancel</button>
                        <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">{saving ? 'Saving…' : 'Save UDF'}</button>
                    </div>
                </form>
            </div>
        </>
    );
}
