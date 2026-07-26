'use client';

import { useState } from 'react';
import { FiPlus, FiLock, FiCopy, FiEdit, FiTrash2, FiChevronDown, FiChevronRight } from 'react-icons/fi';

type TemplateActivity = {
    id?: string;
    sequence_number: number;
    description: string;
    activity_code: string | null;
    activity_library_id?: string | null;
    duration_hours: number | null;
    is_optional: boolean;
    predecessor_sequences: number[];
    udf_defaults: Record<string, string> | null;
    hold_point_type?: string | null;
};

type TemplateChecklistItem = {
    id: string;
    checklist_type: 'dropping' | 'boxup';
    sequence_number: number;
    description: string;
    responsible_party: string | null;
    is_mandatory: boolean;
};

type Template = {
    id: string;
    name: string;
    equipment_type: string;
    job_type: string;
    description: string | null;
    is_system: boolean;
    is_active: boolean;
    organization_id: string | null;
    activities: TemplateActivity[];
    checklist_items: TemplateChecklistItem[];
};

type ActivityCodeOption = {
    id: string;
    code: string;
    description: string;
    duration_hours?: number | null;
    discipline_code?: string | null;
    discipline_name?: string | null;
};

type Props = {
    templates: Template[];
    activityCodes: ActivityCodeOption[];
    disciplines: Array<{ id: string; code: string; name: string }>;
    orgId: string;
};

export function WorkpackTemplatesClient({
    templates,
    activityCodes,
    disciplines,
    orgId,
}: Props) {
    const [expanded, setExpanded] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
    const [localTemplates, setLocalTemplates] = useState(templates);

    const systemTemplates = localTemplates.filter((t) => t.is_system);
    const orgTemplates = localTemplates.filter((t) => !t.is_system);

    const handleCopySystem = async (template: Template) => {
        const res = await fetch(`/api/settings/templates/${template.id}/copy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId }),
        });
        if (res.ok) {
            const newTemplate = await res.json();
            setLocalTemplates((prev) => [...prev, newTemplate]);
        }
    };

    const handleDelete = async (templateId: string) => {
        if (!confirm('Delete this template? This cannot be undone.')) return;
        const res = await fetch(`/api/settings/templates/${templateId}`, {
            method: 'DELETE',
        });
        if (res.ok) {
            setLocalTemplates((prev) => prev.filter((t) => t.id !== templateId));
        }
    };

    return (
        <div className="space-y-8">
            {/* ── System Templates ── */}
            <section>
                <div className="flex items-center gap-2 mb-3">
                    <FiLock className="w-4 h-4 text-gray-400" />
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                        System Starter Templates
                    </h2>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        Read-only — copy to customise
                    </span>
                </div>
                <div className="space-y-2">
                    {systemTemplates.length === 0 && (
                        <p className="text-sm text-gray-400 italic">
                            No system templates found. Check seed data.
                        </p>
                    )}
                    {systemTemplates.map((t) => (
                        <TemplateRow
                            key={t.id}
                            template={t}
                            isExpanded={expanded === t.id}
                            onToggle={() => setExpanded(expanded === t.id ? null : t.id)}
                            onCopy={() => handleCopySystem(t)}
                            isSystem
                        />
                    ))}
                </div>
            </section>

            {/* ── Org Templates ── */}
            <section>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                        Your Organisation&apos;s Templates
                    </h2>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                    >
                        <FiPlus className="w-4 h-4" />
                        New Template
                    </button>
                </div>
                <div className="space-y-2">
                    {orgTemplates.length === 0 && (
                        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                            <p className="text-sm text-gray-500">No templates yet.</p>
                            <p className="text-xs text-gray-400 mt-1">
                                Create one or copy a system template above.
                            </p>
                        </div>
                    )}
                    {orgTemplates.map((t) => (
                        <TemplateRow
                            key={t.id}
                            template={t}
                            isExpanded={expanded === t.id}
                            onToggle={() => setExpanded(expanded === t.id ? null : t.id)}
                            onEdit={() => setEditingTemplate(t)}
                            onDelete={() => handleDelete(t.id)}
                            isSystem={false}
                        />
                    ))}
                </div>
            </section>

            {showCreateModal && (
                <TemplateFormDrawer
                    activityCodes={activityCodes}
                    disciplines={disciplines}
                    orgId={orgId}
                    onClose={() => setShowCreateModal(false)}
                    onSaved={(t) => {
                        setLocalTemplates((prev) => [...prev, t]);
                        setShowCreateModal(false);
                    }}
                />
            )}

            {editingTemplate && (
                <TemplateFormDrawer
                    template={editingTemplate}
                    activityCodes={activityCodes}
                    disciplines={disciplines}
                    orgId={orgId}
                    onClose={() => setEditingTemplate(null)}
                    onSaved={(t) => {
                        setLocalTemplates((prev) =>
                            prev.map((x) => (x.id === t.id ? t : x))
                        );
                        setEditingTemplate(null);
                    }}
                />
            )}
        </div>
    );
}

function TemplateRow({
    template,
    isExpanded,
    onToggle,
    onCopy,
    onEdit,
    onDelete,
    isSystem,
}: {
    template: Template;
    isExpanded: boolean;
    onToggle: () => void;
    onCopy?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    isSystem: boolean;
}) {
    const droppingItems = template.checklist_items.filter(
        (i) => i.checklist_type === 'dropping'
    );
    const boxupItems = template.checklist_items.filter(
        (i) => i.checklist_type === 'boxup'
    );

    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                onClick={onToggle}
            >
                {isExpanded ? (
                    <FiChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                ) : (
                    <FiChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 text-sm">
                            {template.name}
                        </span>
                        {isSystem && (
                            <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded">
                                System
                            </span>
                        )}
                        {!template.is_active && (
                            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                                Inactive
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">
                            {template.equipment_type}
                        </span>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs text-gray-500">{template.job_type}</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs text-gray-400">
                            {template.activities.length} activities
                        </span>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs text-gray-400">
                            {droppingItems.length} dropping / {boxupItems.length} boxup
                            checklist items
                        </span>
                    </div>
                </div>
                <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                >
                    {isSystem && (
                        <button
                            onClick={onCopy}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                            title="Copy to my organisation"
                        >
                            <FiCopy className="w-3.5 h-3.5" />
                            Copy
                        </button>
                    )}
                    {!isSystem && (
                        <>
                            <button
                                onClick={onEdit}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                title="Edit template"
                            >
                                <FiEdit className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={onDelete}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Delete template"
                            >
                                <FiTrash2 className="w-3.5 h-3.5" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {isExpanded && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-4">
                    <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                            Activities ({template.activities.length})
                        </h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-gray-200">
                                        <th className="text-left py-1.5 px-2 text-gray-500 font-medium">
                                            #
                                        </th>
                                        <th className="text-left py-1.5 px-2 text-gray-500 font-medium">
                                            Code
                                        </th>
                                        <th className="text-left py-1.5 px-2 text-gray-500 font-medium">
                                            Description
                                        </th>
                                        <th className="text-left py-1.5 px-2 text-gray-500 font-medium">
                                            Duration
                                        </th>
                                        <th className="text-left py-1.5 px-2 text-gray-500 font-medium">
                                            Hold Point
                                        </th>
                                        <th className="text-left py-1.5 px-2 text-gray-500 font-medium">
                                            Predecessors
                                        </th>
                                        <th className="text-left py-1.5 px-2 text-gray-500 font-medium">
                                            Optional
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {template.activities.map((a) => {
                                        const holdPoint =
                                            (a.udf_defaults as Record<string, string>)
                                                ?.hold_point_type ?? a.hold_point_type;
                                        return (
                                            <tr
                                                key={a.id}
                                                className="border-b border-gray-100 last:border-0"
                                            >
                                                <td className="py-1.5 px-2 text-gray-600">
                                                    {a.sequence_number}
                                                </td>
                                                <td className="py-1.5 px-2">
                                                    {a.activity_code ? (
                                                        <span className="font-mono bg-gray-100 px-1 rounded">
                                                            {a.activity_code}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                                <td className="py-1.5 px-2 text-gray-800">
                                                    {a.description}
                                                </td>
                                                <td className="py-1.5 px-2 text-gray-600">
                                                    {a.duration_hours
                                                        ? `${a.duration_hours}h`
                                                        : '—'}
                                                </td>
                                                <td className="py-1.5 px-2">
                                                    {holdPoint &&
                                                    holdPoint !== 'None' &&
                                                    holdPoint !== 'none' ? (
                                                        <span
                                                            className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                                                holdPoint === 'H'
                                                                    ? 'bg-red-100 text-red-700'
                                                                    : holdPoint === 'W'
                                                                      ? 'bg-amber-100 text-amber-700'
                                                                      : holdPoint === 'R'
                                                                        ? 'bg-blue-100 text-blue-700'
                                                                        : 'bg-gray-100 text-gray-600'
                                                            }`}
                                                        >
                                                            {holdPoint}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                                <td className="py-1.5 px-2 text-gray-600">
                                                    {a.predecessor_sequences?.length > 0
                                                        ? a.predecessor_sequences.join(', ')
                                                        : '—'}
                                                </td>
                                                <td className="py-1.5 px-2">
                                                    {a.is_optional ? (
                                                        <span className="text-amber-600">
                                                            Optional
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {(droppingItems.length > 0 || boxupItems.length > 0) && (
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { label: 'Dropping Checklist', items: droppingItems },
                                { label: 'Boxup Checklist', items: boxupItems },
                            ].map(({ label, items }) => (
                                <div key={label}>
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                                        {label} ({items.length})
                                    </h4>
                                    {items.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic">
                                            No items
                                        </p>
                                    ) : (
                                        <ol className="space-y-1">
                                            {items.map((item, i) => (
                                                <li
                                                    key={item.id}
                                                    className="flex items-start gap-2 text-xs"
                                                >
                                                    <span className="text-gray-400 flex-shrink-0 w-4">
                                                        {i + 1}.
                                                    </span>
                                                    <span className="text-gray-700">
                                                        {item.description}
                                                    </span>
                                                    {item.is_mandatory && (
                                                        <span className="text-red-500 flex-shrink-0">
                                                            *
                                                        </span>
                                                    )}
                                                </li>
                                            ))}
                                        </ol>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Template Activities Editor (MS Project style grid) ─────────────────────
const HOLD_POINT_OPTIONS = [
    { value: '', label: 'None' },
    { value: 'H', label: 'H' },
    { value: 'W', label: 'W' },
    { value: 'R', label: 'R' },
    { value: 'I', label: 'I' },
];

function TemplateActivitiesEditor({
    activities,
    setActivities,
    activityCodes,
    disciplines,
}: {
    activities: Partial<TemplateActivity>[];
    setActivities: React.Dispatch<React.SetStateAction<Partial<TemplateActivity>[]>>;
    activityCodes: ActivityCodeOption[];
    disciplines: Array<{ id: string; code: string; name: string }>;
}) {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [predecessorOpenIndex, setPredecessorOpenIndex] = useState<number | null>(null);

    const addRow = () => {
        const nextSeq = activities.length + 1;
        setActivities((prev) => [
            ...prev,
            {
                sequence_number: nextSeq,
                activity_code: null,
                description: '',
                duration_hours: null,
                is_optional: false,
                predecessor_sequences: [],
                udf_defaults: {},
            },
        ]);
    };

    const updateRow = (index: number, updates: Partial<TemplateActivity>) => {
        setActivities((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], ...updates };
            return next.map((a, i) => ({ ...a, sequence_number: i + 1 }));
        });
    };

    const deleteRow = (index: number) => {
        if (!confirm('Delete this activity row?')) return;
        setActivities((prev) => prev.filter((_, i) => i !== index).map((a, i) => ({ ...a, sequence_number: i + 1 })));
        setSelectedIndex(null);
    };

    const moveUp = (index: number) => {
        if (index <= 0) return;
        setActivities((prev) => {
            const next = [...prev];
            [next[index - 1], next[index]] = [next[index], next[index - 1]];
            return next.map((a, i) => ({ ...a, sequence_number: i + 1 }));
        });
        setSelectedIndex(index - 1);
    };

    const moveDown = (index: number) => {
        if (index >= activities.length - 1) return;
        setActivities((prev) => {
            const next = [...prev];
            [next[index], next[index + 1]] = [next[index + 1], next[index]];
            return next.map((a, i) => ({ ...a, sequence_number: i + 1 }));
        });
        setSelectedIndex(index + 1);
    };

    const onCodeSelect = (index: number, codeId: string) => {
        const code = activityCodes.find((c) => c.id === codeId);
        if (!code) return;
        const udf = (activities[index]?.udf_defaults as Record<string, string>) ?? {};
        if (code.discipline_code) udf.discipline = code.discipline_code;
        updateRow(index, {
            activity_library_id: codeId,
            activity_code: code.code,
            description: code.description || '',
            duration_hours: code.duration_hours ?? null,
            udf_defaults: udf,
        });
    };

    const row = (index: number) => activities[index];
    const getUdf = (index: number, key: string) => (row(index)?.udf_defaults as Record<string, string>)?.[key] ?? '';

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">Activities</h3>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={addRow}
                        className="flex items-center gap-1 px-2 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        <FiPlus className="w-3.5 h-3.5" />
                        Add Activity
                    </button>
                    {selectedIndex != null && (
                        <>
                            <button type="button" onClick={() => moveUp(selectedIndex)} disabled={selectedIndex === 0} className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                                Move Up
                            </button>
                            <button type="button" onClick={() => moveDown(selectedIndex)} disabled={selectedIndex === activities.length - 1} className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                                Move Down
                            </button>
                            <button type="button" onClick={() => deleteRow(selectedIndex)} className="px-2 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                                Delete Row
                            </button>
                        </>
                    )}
                </div>
            </div>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="w-8 py-1.5 px-1 text-left text-gray-500 font-medium">#</th>
                            <th className="w-36 py-1.5 px-2 text-left text-gray-500 font-medium">Activity Code</th>
                            <th className="min-w-[160px] py-1.5 px-2 text-left text-gray-500 font-medium">Description</th>
                            <th className="w-20 py-1.5 px-2 text-left text-gray-500 font-medium">Dur (h)</th>
                            <th className="w-24 py-1.5 px-2 text-left text-gray-500 font-medium">Discipline</th>
                            <th className="w-20 py-1.5 px-2 text-left text-gray-500 font-medium">Hold Pt</th>
                            <th className="w-24 py-1.5 px-2 text-left text-gray-500 font-medium">Predecessors</th>
                            <th className="w-16 py-1.5 px-2 text-left text-gray-500 font-medium">Optional</th>
                            <th className="w-10 py-1.5 px-1" />
                        </tr>
                    </thead>
                    <tbody>
                        {activities.map((act, index) => (
                            <tr
                                key={act.id ?? index}
                                className={`border-b border-gray-100 ${selectedIndex === index ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                                onClick={() => setSelectedIndex(index)}
                            >
                                <td className="py-1 px-2 text-gray-500">{index + 1}</td>
                                <td className="py-1 px-2">
                                    <select
                                        value={act.activity_library_id ?? act.activity_code ?? ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val) onCodeSelect(index, val);
                                            else updateRow(index, { activity_library_id: null, activity_code: null, description: '', duration_hours: null });
                                        }}
                                        className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <option value="">—</option>
                                        {activityCodes.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.code} {c.description ? `— ${c.description.slice(0, 30)}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td className="py-1 px-2">
                                    <input
                                        type="text"
                                        value={act.description ?? ''}
                                        onChange={(e) => updateRow(index, { description: e.target.value })}
                                        className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </td>
                                <td className="py-1 px-2">
                                    <input
                                        type="number"
                                        min={0.5}
                                        step={0.5}
                                        value={act.duration_hours ?? ''}
                                        onChange={(e) => updateRow(index, { duration_hours: e.target.value ? Number(e.target.value) : null })}
                                        className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </td>
                                <td className="py-1 px-2">
                                    <select
                                        value={getUdf(index, 'discipline')}
                                        onChange={(e) => {
                                            const udf = { ...(act.udf_defaults as Record<string, string>), discipline: e.target.value };
                                            updateRow(index, { udf_defaults: udf });
                                        }}
                                        className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <option value="">—</option>
                                        {disciplines.map((d) => (
                                            <option key={d.id} value={d.code}>
                                                {d.code}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td className="py-1 px-2">
                                    <select
                                        value={act.hold_point_type ?? ''}
                                        onChange={(e) => updateRow(index, { hold_point_type: e.target.value || null })}
                                        className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {HOLD_POINT_OPTIONS.map((o) => (
                                            <option key={o.value || 'none'} value={o.value}>
                                                {o.label}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td className="py-1 px-2">
                                    <div className="relative">
                                        <button
                                            type="button"
                                            className="w-full border border-gray-300 rounded px-1.5 py-1 text-left text-xs text-gray-600"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPredecessorOpenIndex(predecessorOpenIndex === index ? null : index);
                                            }}
                                        >
                                            {(act.predecessor_sequences?.length ?? 0) > 0
                                                ? act.predecessor_sequences!.join(', ')
                                                : '—'}
                                        </button>
                                        {predecessorOpenIndex === index && (
                                            <div className="absolute left-0 top-full mt-0.5 z-10 bg-white border border-gray-200 rounded shadow-lg p-2 max-h-40 overflow-y-auto">
                                                {activities.map((_, i) => (
                                                    <label key={i} className="flex items-center gap-2 text-xs">
                                                        <input
                                                            type="checkbox"
                                                            checked={act.predecessor_sequences?.includes(i + 1) ?? false}
                                                            onChange={(e) => {
                                                                const seq = i + 1;
                                                                const current = act.predecessor_sequences ?? [];
                                                                const next = e.target.checked ? [...current, seq] : current.filter((s) => s !== seq);
                                                                updateRow(index, { predecessor_sequences: next });
                                                            }}
                                                        />
                                                        {i + 1}
                                                    </label>
                                                ))}
                                                <button type="button" className="mt-1 text-xs text-gray-500" onClick={() => setPredecessorOpenIndex(null)}>Close</button>
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="py-1 px-2">
                                    <input
                                        type="checkbox"
                                        checked={act.is_optional ?? false}
                                        onChange={(e) => updateRow(index, { is_optional: e.target.checked })}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </td>
                                <td className="py-1 px-1">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteRow(index);
                                        }}
                                        className="p-1 text-gray-400 hover:text-red-600"
                                    >
                                        ×
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── Template Checklist Editor ─────────────────────────────────────────────
function TemplateChecklistEditor({
    label,
    checklistType,
    items,
    onChange,
}: {
    label: string;
    checklistType: 'dropping' | 'boxup';
    items: Partial<TemplateChecklistItem>[];
    onChange: React.Dispatch<React.SetStateAction<Partial<TemplateChecklistItem>[]>>;
}) {
    const updateItem = (index: number, updates: Partial<TemplateChecklistItem>) => {
        onChange((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], ...updates, sequence_number: index + 1 };
            return next;
        });
    };

    const addItem = () => {
        onChange((prev) => [...prev, { checklist_type: checklistType, sequence_number: prev.length + 1, description: '', responsible_party: null, is_mandatory: true }]);
    };

    const removeItem = (index: number) => {
        onChange((prev) => prev.filter((_, i) => i !== index).map((it, i) => ({ ...it, sequence_number: i + 1 })));
    };

    const moveUp = (index: number) => {
        if (index <= 0) return;
        onChange((prev) => {
            const next = [...prev];
            [next[index - 1], next[index]] = [next[index], next[index - 1]];
            return next.map((it, i) => ({ ...it, sequence_number: i + 1 }));
        });
    };

    const moveDown = (index: number) => {
        if (index >= items.length - 1) return;
        onChange((prev) => {
            const next = [...prev];
            [next[index], next[index + 1]] = [next[index + 1], next[index]];
            return next.map((it, i) => ({ ...it, sequence_number: i + 1 }));
        });
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">{label}</h3>
                <button
                    type="button"
                    onClick={addItem}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                    <FiPlus className="w-3.5 h-3.5" />
                    Add Item
                </button>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
                {items.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-3 px-4">No items. Click &quot;Add Item&quot; to add.</p>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {items.map((item, index) => (
                            <li key={item.id ?? index} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50">
                                <span className="text-gray-400 w-6 text-xs">{index + 1}</span>
                                <input
                                    type="text"
                                    value={item.description ?? ''}
                                    onChange={(e) => updateItem(index, { description: e.target.value })}
                                    placeholder="Description"
                                    className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-xs"
                                />
                                <input
                                    type="text"
                                    value={item.responsible_party ?? ''}
                                    onChange={(e) => updateItem(index, { responsible_party: e.target.value || null })}
                                    placeholder="Responsible"
                                    className="w-28 border border-gray-300 rounded px-2 py-1 text-xs"
                                />
                                <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                                    <input
                                        type="checkbox"
                                        checked={item.is_mandatory ?? true}
                                        onChange={(e) => updateItem(index, { is_mandatory: e.target.checked })}
                                    />
                                    Mandatory
                                </label>
                                <div className="flex gap-0.5">
                                    <button type="button" onClick={() => moveUp(index)} disabled={index === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">↑</button>
                                    <button type="button" onClick={() => moveDown(index)} disabled={index === items.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">↓</button>
                                </div>
                                <button type="button" onClick={() => removeItem(index)} className="p-1 text-gray-400 hover:text-red-600">×</button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

function TemplateFormDrawer({
    template,
    activityCodes,
    disciplines,
    orgId,
    onClose,
    onSaved,
}: {
    template?: Template;
    activityCodes: Props['activityCodes'];
    disciplines: Props['disciplines'];
    orgId: string;
    onClose: () => void;
    onSaved: (t: Template) => void;
}) {
    const isEdit = !!template;
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const [name, setName] = useState(template?.name ?? '');
    const [equipmentType, setEquipmentType] = useState(
        template?.equipment_type ?? ''
    );
    const [jobType, setJobType] = useState(template?.job_type ?? '');
    const [description, setDescription] = useState(
        template?.description ?? ''
    );
    const [activities, setActivities] = useState<Partial<TemplateActivity>[]>(
        template?.activities ?? []
    );
    const [droppingItems, setDroppingItems] = useState<
        Partial<TemplateChecklistItem>[]
    >(
        template?.checklist_items.filter(
            (i) => i.checklist_type === 'dropping'
        ) ?? []
    );
    const [boxupItems, setBoxupItems] = useState<
        Partial<TemplateChecklistItem>[]
    >(
        template?.checklist_items.filter((i) => i.checklist_type === 'boxup') ??
            []
    );

    const handleSave = async () => {
        if (!name || !equipmentType || !jobType) {
            setError('Name, Equipment Type and Job Type are required.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const url = isEdit
                ? `/api/settings/templates/${template!.id}`
                : '/api/settings/templates';
            const method = isEdit ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    equipmentType,
                    jobType,
                    description,
                    activities,
                    droppingItems,
                    boxupItems,
                    orgId,
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error ?? 'Save failed');
            }
            const saved = await res.json();
            onSaved(saved);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-black/40" onClick={onClose} />
            <div className="w-full max-w-3xl bg-white shadow-2xl flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="text-lg font-semibold text-gray-900">
                        {isEdit ? 'Edit Template' : 'New Template'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Template Name *
                            </label>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                placeholder="e.g. Heat Exchanger Retubing"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Equipment Type *
                            </label>
                            <input
                                value={equipmentType}
                                onChange={(e) => setEquipmentType(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                placeholder="e.g. Heat Exchanger"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Job Type *
                            </label>
                            <input
                                value={jobType}
                                onChange={(e) => setJobType(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                placeholder="e.g. Retubing"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={2}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                    </div>

                    <TemplateActivitiesEditor
                        activities={activities}
                        setActivities={setActivities}
                        activityCodes={activityCodes}
                        disciplines={disciplines}
                    />

                    <TemplateChecklistEditor
                        label="Dropping Checklist"
                        checklistType="dropping"
                        items={droppingItems}
                        onChange={setDroppingItems}
                    />

                    <TemplateChecklistEditor
                        label="Boxup Checklist"
                        checklistType="boxup"
                        items={boxupItems}
                        onChange={setBoxupItems}
                    />

                    {error && (
                        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                            {error}
                        </p>
                    )}
                </div>

                <div className="px-6 py-4 border-t flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {saving
                            ? 'Saving…'
                            : isEdit
                              ? 'Save Changes'
                              : 'Create Template'}
                    </button>
                </div>
            </div>
        </div>
    );
}
