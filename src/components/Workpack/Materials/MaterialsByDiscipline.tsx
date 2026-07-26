'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MATERIAL_DISCIPLINES,
  DISCIPLINE_MAP,
  type MaterialDiscipline,
} from '@/lib/materials/disciplines';

interface Material {
  id: string;
  description: string;
  customName: string | null;
  discipline: string;
  quantity: number;
  uom: string;
  specification: string | null;
  includedInPdf: boolean;
  aiGenerated: boolean;
  plannerNotes: string | null;
  activity: { activityId: string; description: string };
}

const iconCls = 'flex-shrink-0';
function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? iconCls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
    </svg>
  );
}
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? iconCls} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}
function XMarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? iconCls} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? iconCls} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  );
}
function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? iconCls} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  );
}

function EditableCell({
  value,
  onSave,
  className = '',
  type = 'text',
  options,
}: {
  value: string | number;
  onSave: (val: string) => Promise<void>;
  className?: string;
  type?: 'text' | 'number' | 'select';
  options?: { value: string; label: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (draft === String(value)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 min-w-[80px]">
        {type === 'select' && options ? (
          <select
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => save()}
            className="text-xs border border-indigo-400 rounded px-1 py-0.5 bg-white w-full"
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            autoFocus
            type={type}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') setEditing(false);
            }}
            onBlur={() => save()}
            className="text-xs border border-indigo-400 rounded px-1 py-0.5 bg-white w-full"
          />
        )}
        <button type="button" onClick={() => save()} disabled={saving} className="flex-shrink-0 text-green-600">
          <CheckIcon className="w-3 h-3" />
        </button>
        <button type="button" onClick={() => setEditing(false)} className="flex-shrink-0 text-gray-400">
          <XMarkIcon className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
      onKeyDown={(e) => e.key === 'Enter' && (setDraft(String(value)), setEditing(true))}
      className={`group/cell cursor-pointer flex items-center gap-1 px-1 py-0.5 rounded hover:bg-indigo-50 hover:outline hover:outline-1 hover:outline-indigo-300 transition-all ${className}`}
      title="Click to edit"
    >
      <span className="text-xs">{value}</span>
      <PencilIcon className="w-2.5 h-2.5 text-indigo-400 opacity-0 group-hover/cell:opacity-100 flex-shrink-0" />
    </div>
  );
}

function MaterialRow({
  material,
  onUpdate,
  onDelete,
}: {
  material: Material;
  onUpdate: (id: string, field: string, value: unknown) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const disc = DISCIPLINE_MAP[material.discipline as MaterialDiscipline];
  const displayName = material.customName || material.description;

  return (
    <tr
      className={`group border-b border-gray-100 transition-colors ${
        !material.includedInPdf ? 'opacity-40 bg-gray-50' : 'hover:bg-gray-50'
      }`}
    >
      <td className="pl-4 pr-2 py-2 w-8">
        <input
          type="checkbox"
          checked={material.includedInPdf}
          onChange={(e) => onUpdate(material.id, 'includedInPdf', e.target.checked)}
          className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          title={material.includedInPdf ? 'Included in PDF — click to exclude' : 'Excluded from PDF — click to include'}
        />
      </td>
      <td className="px-2 py-2 min-w-[200px]">
        <div className="flex items-start gap-1.5">
          <div className="flex-1">
            <EditableCell
              value={displayName}
              onSave={(val) => onUpdate(material.id, 'customName', val)}
              className="font-medium text-gray-900"
            />
            {material.customName && material.customName !== material.description && (
              <p className="text-gray-400 text-xs italic ml-1 mt-0.5 line-through">{material.description}</p>
            )}
          </div>
          {material.aiGenerated && !material.customName && (
            <span className="flex-shrink-0 text-xs text-amber-500 font-medium mt-1" title="AI generated — click name to edit">
              AI
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-2 min-w-[140px]">
        <EditableCell
          value={material.specification ?? '—'}
          onSave={(val) => onUpdate(material.id, 'specification', val)}
          className="text-gray-600"
        />
      </td>
      <td className="px-2 py-2 w-20">
        <EditableCell
          value={material.quantity}
          onSave={(val) => onUpdate(material.id, 'quantity', parseFloat(val) || 0)}
          type="number"
          className="text-gray-900 font-medium"
        />
      </td>
      <td className="px-2 py-2 w-20">
        <EditableCell
          value={material.uom}
          onSave={(val) => onUpdate(material.id, 'uom', val.toUpperCase())}
          className="text-gray-600"
        />
      </td>
      <td className="px-2 py-2 w-36">
        <EditableCell
          value={material.discipline}
          onSave={(val) => onUpdate(material.id, 'discipline', val)}
          type="select"
          options={MATERIAL_DISCIPLINES.map((d) => ({ value: d.key, label: `${d.icon} ${d.label}` }))}
          className=""
        />
        {disc && (
          <span className={`mt-0.5 inline-flex text-xs px-1.5 py-0.5 rounded-full font-medium ${disc.color.badge}`}>
            {disc.icon} {disc.label}
          </span>
        )}
      </td>
      <td className="px-2 py-2 w-28">
        <span className="text-xs text-gray-400 font-mono">{material.activity?.activityId ?? '—'}</span>
      </td>
      <td className="px-2 py-2 w-10">
        <button
          type="button"
          onClick={() => onDelete(material.id)}
          className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Remove material"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

function DisciplineGroup({
  disciplineKey,
  materials,
  onUpdate,
  onDelete,
  onBulkToggle,
}: {
  disciplineKey: string;
  materials: Material[];
  onUpdate: (id: string, field: string, value: unknown) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onBulkToggle: (disciplineKey: string, value: boolean) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(true);
  const disc = DISCIPLINE_MAP[disciplineKey as MaterialDiscipline];
  if (!disc || materials.length === 0) return null;

  const includedCount = materials.filter((m) => m.includedInPdf).length;
  const allIncluded = includedCount === materials.length;
  const noneIncluded = includedCount === 0;

  return (
    <div className={`border rounded-lg overflow-hidden mb-4 ${disc.color.border}`}>
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none ${disc.color.bg}`}
        onClick={() => setExpanded((e) => !e)}
      >
        {expanded ? (
          <ChevronDownIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronRightIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
        )}
        <span className="text-base">{disc.icon}</span>
        <div className="flex-1">
          <span className="font-semibold text-gray-900 text-sm">{disc.label}</span>
          <span className="ml-2 text-xs text-gray-500">{disc.sectionCode}</span>
        </div>
        <div className="flex items-center gap-3 text-xs" onClick={(e) => e.stopPropagation()}>
          <span className={`font-medium ${includedCount > 0 ? 'text-green-700' : 'text-gray-400'}`}>
            {includedCount} / {materials.length} in PDF
          </span>
          <button
            type="button"
            onClick={() => onBulkToggle(disciplineKey, true)}
            disabled={allIncluded}
            className="px-2 py-1 border rounded text-xs text-green-700 border-green-300 hover:bg-green-50 disabled:opacity-40 disabled:cursor-default"
            title="Include all in this discipline"
          >
            ✓ All
          </button>
          <button
            type="button"
            onClick={() => onBulkToggle(disciplineKey, false)}
            disabled={noneIncluded}
            className="px-2 py-1 border rounded text-xs text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-40 disabled:cursor-default"
            title="Exclude all in this discipline"
          >
            ✗ None
          </button>
        </div>
      </div>
      {expanded && (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="pl-4 pr-2 py-2 w-8">
                  <span className="text-xs text-gray-500" title="Include in PDF">
                    PDF
                  </span>
                </th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-600">Material Description</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-600">Specification / Grade</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 w-20">Qty</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 w-20">UOM</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 w-36">Discipline</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 w-28">Activity</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {materials.map((mat) => (
                <MaterialRow key={mat.id} material={mat} onUpdate={onUpdate} onDelete={onDelete} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function MaterialsByDiscipline({ workpackId }: { workpackId: string }) {
  const [grouped, setGrouped] = useState<Record<string, Material[]>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState<'all' | 'included' | 'excluded'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/workpacks/${workpackId}/materials?grouped=true`);
    const data = await res.json();
    setGrouped(data.grouped ?? {});
    setLoading(false);
  }, [workpackId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpdate = async (id: string, field: string, value: unknown) => {
    const body: Record<string, unknown> = {};
    if (field === 'customName') body.customName = value;
    else if (field === 'specification') body.specification = value;
    else if (field === 'quantity') body.quantity_required = value;
    else if (field === 'uom') body.unit_of_measure = value;
    else if (field === 'discipline') body.discipline = value;
    else if (field === 'includedInPdf') body.includedInPdf = value;
    else body[field] = value;
    await fetch(`/api/workpacks/${workpackId}/materials/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this material?')) return;
    await fetch(`/api/workpacks/${workpackId}/materials/${id}`, { method: 'DELETE' });
    await load();
  };

  const handleBulkToggle = async (disciplineKey: string, value: boolean) => {
    await fetch(`/api/workpacks/${workpackId}/materials/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setIncluded', discipline: disciplineKey, value }),
    });
    await load();
  };

  const generateMaterials = async () => {
    setGenerating(true);
    try {
      await fetch(`/api/workpacks/${workpackId}/materials/generate-with-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoSave: true, regenerate: true }),
      });
      await load();
    } finally {
      setGenerating(false);
    }
  };

  const allMaterials = Object.values(grouped).flat();
  const totalIncluded = allMaterials.filter((m) => m.includedInPdf).length;
  const disciplineCount = Object.keys(grouped).filter((k) => grouped[k]?.length > 0).length;

  if (loading)
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-500">
        Loading materials...
      </div>
    );

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Section J — Materials List</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {allMaterials.length} items across {disciplineCount} discipline(s) · {totalIncluded} included in PDF
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search materials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-1.5 w-48 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'included' | 'excluded')}
            className="text-sm border border-gray-300 rounded-md px-2 py-1.5"
          >
            <option value="all">All items</option>
            <option value="included">PDF included only</option>
            <option value="excluded">Excluded only</option>
          </select>
          <button
            type="button"
            onClick={generateMaterials}
            disabled={generating}
            className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {generating ? (
              <>
                <span className="animate-spin">⟳</span> Generating...
              </>
            ) : (
              <>✨ Regenerate with AI</>
            )}
          </button>
        </div>
      </div>

      {allMaterials.some((m) => m.aiGenerated && !m.customName) && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <span className="text-amber-500 text-lg flex-shrink-0">⚠</span>
          <div className="text-sm">
            <span className="font-medium text-amber-800">AI-generated materials — please review before printing.</span>
            <span className="text-amber-700 ml-1">
              Click any cell to edit. Uncheck the PDF box to exclude items. Discipline can be changed if misclassified.
            </span>
          </div>
        </div>
      )}

      {allMaterials.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📦</p>
          <p className="font-medium">No materials yet</p>
          <p className="text-sm mt-1">
            Click &quot;Regenerate with AI&quot; to generate materials from activities and uploaded documents.
          </p>
        </div>
      ) : (
        MATERIAL_DISCIPLINES.map((disc) => {
          let items = grouped[disc.key] ?? [];
          if (searchQuery) {
            const q = searchQuery.toLowerCase();
            items = items.filter(
              (m) =>
                (m.customName ?? m.description).toLowerCase().includes(q) ||
                m.specification?.toLowerCase().includes(q)
            );
          }
          if (filter === 'included') items = items.filter((m) => m.includedInPdf);
          if (filter === 'excluded') items = items.filter((m) => !m.includedInPdf);
          if (items.length === 0) return null;
          return (
            <DisciplineGroup
              key={disc.key}
              disciplineKey={disc.key}
              materials={items}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onBulkToggle={handleBulkToggle}
            />
          );
        })
      )}
    </div>
  );
}
