'use client';

import { useState, useEffect, useCallback } from 'react';
import { normaliseField } from '@/lib/ai/technicalDataHelpers';

const iconCls = 'flex-shrink-0';
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? iconCls} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}
function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? iconCls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
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
function ExclamationTriangleIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? iconCls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
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

type TechData = Record<string, unknown>;

function displayValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

function FieldRow({
  label,
  path,
  stored,
  unit = '',
  onSave,
}: {
  label: string;
  path: string;
  stored: unknown;
  unit?: string;
  onSave: (path: string, value: string, action: 'confirm' | 'edit') => Promise<void>;
}) {
  const field = normaliseField(stored);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const hasValue = field.value !== null && field.value !== undefined && field.value !== '';
  const displayVal = displayValue(field.value) + (hasValue && unit ? ` ${unit}` : '');
  const originalVal = displayValue(field.aiOriginal) + (field.aiOriginal != null && field.aiOriginal !== '' && unit ? ` ${unit}` : '');

  const startEdit = () => {
    setDraft(hasValue ? String(field.value) : '');
    setEditing(true);
  };

  const save = async (action: 'confirm' | 'edit') => {
    setSaving(true);
    const val = action === 'confirm' ? String(field.value) : draft.trim();
    await onSave(path, val, action);
    setSaving(false);
    setEditing(false);
  };

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 group last:border-0 transition-colors ${
        hasValue && !field.confirmed ? 'bg-amber-50/70' : 'hover:bg-gray-50/60'
      }`}
    >
      <span className="w-40 text-xs text-gray-500 flex-shrink-0">{label}</span>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save('edit');
                if (e.key === 'Escape') setEditing(false);
              }}
              placeholder={`Enter ${label.toLowerCase()}${unit ? ` (${unit})` : ''}`}
              className="flex-1 text-xs border border-indigo-400 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-mono"
            />
            <button
              type="button"
              onClick={() => save('edit')}
              disabled={saving || !draft.trim()}
              className="px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-1"
            >
              {saving ? '…' : (
                <>
                  <CheckIcon className="w-3 h-3" />
                  Save
                </>
              )}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="p-1 text-gray-400 hover:text-gray-600">
              <XMarkIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-xs font-mono font-medium truncate ${hasValue ? 'text-gray-900' : 'text-gray-300'}`}>
              {displayVal}
            </span>
            {field.wasEdited && field.aiOriginal != null && field.aiOriginal !== '' && originalVal !== displayVal && (
              <span className="text-xs font-mono text-gray-300 line-through flex-shrink-0" title="Original AI value">
                {originalVal}
              </span>
            )}
            <button
              type="button"
              onClick={startEdit}
              className="p-0.5 text-gray-300 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              title="Edit value"
            >
              <PencilIcon className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {hasValue && !field.confirmed && !editing && (
          <>
            <span className="flex items-center gap-1 text-[10px] text-amber-600 font-medium">
              <ExclamationTriangleIcon className="w-3 h-3" />
              AI suggested
            </span>
            <button
              type="button"
              onClick={() => save('confirm')}
              disabled={saving}
              className="px-2 py-0.5 text-[10px] font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40 flex items-center gap-1"
            >
              <CheckIcon className="w-2.5 h-2.5" />
              Confirm
            </button>
          </>
        )}
        {field.confirmed && (
          <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
            <CheckIcon className="w-3 h-3" />
            {field.wasEdited ? 'Edited' : 'Confirmed'}
            {field.editedBy && <span className="text-gray-400 font-normal">· {field.editedBy}</span>}
          </span>
        )}
        {!hasValue && (
          <button
            type="button"
            onClick={startEdit}
            className="text-[10px] text-indigo-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            + Add
          </button>
        )}
      </div>
    </div>
  );
}

const ACCENT: Record<string, string> = {
  blue: 'text-blue-700',
  orange: 'text-orange-600',
  purple: 'text-purple-700',
  green: 'text-green-700',
  gray: 'text-gray-600',
  red: 'text-red-600',
};

function Section({
  title,
  sectionKey,
  children,
  pendingCount,
  onConfirmAll,
  defaultOpen = true,
  accentColor = 'gray',
}: {
  title: string;
  sectionKey: string;
  children: React.ReactNode;
  pendingCount: number;
  onConfirmAll: (section: string) => Promise<void>;
  defaultOpen?: boolean;
  accentColor?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [confirming, setConfirming] = useState(false);

  const confirmAll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirming(true);
    await onConfirmAll(sectionKey);
    setConfirming(false);
  };

  return (
    <div className="border-b border-gray-100 last:border-0">
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-gray-50 select-none"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDownIcon className="w-3.5 h-3.5 text-gray-400" />
          ) : (
            <ChevronRightIcon className="w-3.5 h-3.5 text-gray-400" />
          )}
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${ACCENT[accentColor] ?? ACCENT.gray}`}>
            {title}
          </span>
          {pendingCount > 0 && (
            <span className="text-[9px] font-medium bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5">
              {pendingCount} pending
            </span>
          )}
        </div>
        {pendingCount > 0 && (
          <button
            type="button"
            onClick={confirmAll}
            disabled={confirming}
            className="text-[10px] text-green-600 hover:text-green-800 border border-green-300 hover:border-green-500 rounded px-2 py-0.5 flex items-center gap-1 disabled:opacity-40"
          >
            <CheckIcon className="w-3 h-3" />
            {confirming ? 'Confirming…' : 'Confirm all'}
          </button>
        )}
      </div>
      {open && <div>{children}</div>}
    </div>
  );
}

export function EquipmentTechnicalCard({
  workpackId,
  data: initialData,
  onExtracted,
}: {
  workpackId: string;
  data: Record<string, unknown> | null;
  organizationId?: string;
  onExtracted: (data: Record<string, unknown>) => void;
}) {
  const [data, setData] = useState<TechData | null>(initialData);
  const [extracting, setExtracting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [docText, setDocText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [availableDocs, setAvailableDocs] = useState<string[]>([]);
  const [showManualInput, setShowManualInput] = useState(false);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    fetch(`/api/workpacks/${workpackId}/documents`)
      .then((r) => r.json())
      .then((docs: Array<{ original_filename?: string }>) => {
        setAvailableDocs(
          (Array.isArray(docs) ? docs : [])
            .filter((d) => d.original_filename?.toLowerCase().endsWith('.pdf'))
            .map((d) => d.original_filename as string)
        );
      })
      .catch(() => {});
  }, [workpackId]);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/workpacks/${workpackId}/technical-data`);
    const result = await res.json();
    if (result.data) {
      setData(result.data);
      onExtracted(result.data);
    }
  }, [workpackId, onExtracted]);

  const handleExtract = async () => {
    setExtracting(true);
    setError(null);
    try {
      const res = await fetch(`/api/workpacks/${workpackId}/extract-technical-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docText ? { documentText: docText } : {}),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? 'Extraction failed');
      setData((result.data ?? {}) as TechData);
      onExtracted((result.data ?? {}) as Record<string, unknown>);
      setShowModal(false);
      setDocText('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async (path: string, value: string, action: 'confirm' | 'edit') => {
    await fetch(`/api/workpacks/${workpackId}/technical-data`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, value, action }),
    });
    await reload();
  };

  const handleConfirmAll = async (section: string) => {
    await fetch(`/api/workpacks/${workpackId}/technical-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section }),
    });
    await reload();
  };

  const hasData = data && typeof data === 'object' && Object.keys(data).length > 0;

  const countPending = (sectionData: unknown): number => {
    if (!sectionData || typeof sectionData !== 'object') return 0;
    let count = 0;
    for (const v of Object.values(sectionData as Record<string, unknown>)) {
      const f = normaliseField(v);
      if (f.value !== null && f.value !== undefined && f.value !== '' && !f.confirmed) count++;
    }
    return count;
  };

  const totalPending = hasData
    ? ['dimensions', 'tube_bundle', 'shell_side', 'tube_side', 'materials', 'hydrotest'].reduce(
        (acc, key) => acc + countPending(data?.[key]),
        0
      )
    : 0;

  const dims = (data?.dimensions ?? data?.physical_dimensions ?? data?.physicalDimensions ?? {}) as TechData;
  const tubes = (data?.tube_bundle ?? data?.tubeBundle ?? data?.tubes ?? {}) as TechData;
  const shell = (data?.shell_side ?? data?.shellSide ?? data?.shell ?? {}) as TechData;
  const tube = (data?.tube_side ?? data?.tubeSide ?? data?.tube ?? {}) as TechData;
  const mats = (data?.materials ?? data?.materials_of_construction ?? data?.materialsOfConstruction ?? {}) as TechData;
  const ht = (data?.hydrotest ?? {}) as TechData;
  const eq = (data?.equipment ?? {}) as TechData;

  if (!hasData) {
    return (
      <div className="border border-dashed border-gray-200 rounded-xl p-6 text-center bg-gray-50/50">
        <div className="text-3xl mb-2">📋</div>
        <p className="text-sm font-medium text-gray-700">No equipment technical data yet</p>
        <p className="text-xs text-gray-400 mt-1 mb-4">AI will extract data from your uploaded documents</p>
        {availableDocs.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1 mb-4">
            {availableDocs.map((doc, idx) => (
              <span
                key={`${doc}-${idx}`}
                className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded-full border border-blue-100"
              >
                📄 {doc}
              </span>
            ))}
          </div>
        )}
        {error && <p className="text-red-500 text-xs mb-3">⚠ {error}</p>}
        <button
          type="button"
          onClick={handleExtract}
          disabled={extracting}
          className="px-5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 mx-auto"
        >
          {extracting ? (
            <>
              <span className="animate-spin">⟳</span> Extracting…
            </>
          ) : (
            '⚡ Extract Technical Data'
          )}
        </button>
        <button
          type="button"
          onClick={() => setShowManualInput((v) => !v)}
          className="mt-3 text-xs text-gray-400 hover:text-gray-600 block mx-auto"
        >
          Or paste text manually ↓
        </button>
        {showManualInput && (
          <textarea
            value={docText}
            onChange={(e) => setDocText(e.target.value)}
            rows={8}
            placeholder="Paste datasheet text here..."
            className="mt-3 w-full border border-gray-200 rounded-xl p-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        )}
      </div>
    );
  }

  const eqName = normaliseField(eq.name).value;
  const eqType = normaliseField(eq.type).value;
  const eqTema = normaliseField(eq.tema_designation).value;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-3 flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold text-sm">Equipment Technical Data</h3>
          <p className="text-slate-400 text-xs mt-0.5">
            {String(eqName ?? '')} · {String(eqType ?? '')}
            {eqTema != null && String(eqTema) !== '' ? (
              <span className="ml-2 px-1.5 py-0.5 bg-slate-600 rounded text-slate-300 text-[10px] font-mono">
                TEMA {String(eqTema)}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {totalPending > 0 && (
            <span className="text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full px-2.5 py-1">
              ⚠ {totalPending} field{totalPending !== 1 ? 's' : ''} need confirmation
            </span>
          )}
          {totalPending === 0 && hasData && (
            <span className="text-[10px] font-medium text-green-400">✓ All confirmed</span>
          )}
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
          >
            ↻ Re-extract
          </button>
        </div>
      </div>

      {totalPending >= 5 && (
        <div className="bg-amber-50 border-b border-amber-100 px-5 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              AI extracted {totalPending} values — review each field and confirm or correct before printing.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleConfirmAll('all')}
            className="flex-shrink-0 text-xs font-medium bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 flex items-center gap-1"
          >
            <CheckIcon className="w-3.5 h-3.5" />
            Confirm all fields
          </button>
        </div>
      )}

      <div className="divide-y divide-gray-100">
        <Section
          title="Physical Dimensions"
          sectionKey="dimensions"
          pendingCount={countPending(dims)}
          onConfirmAll={handleConfirmAll}
          accentColor="gray"
        >
          <FieldRow label="Shell ID" path="dimensions.shell_id_mm" stored={dims.shell_id_mm} unit="mm" onSave={handleSave} />
          <FieldRow label="Overall Length" path="dimensions.overall_length_mm" stored={dims.overall_length_mm} unit="mm" onSave={handleSave} />
          <FieldRow label="Tube Length" path="dimensions.tube_length_mm" stored={dims.tube_length_mm} unit="mm" onSave={handleSave} />
          <FieldRow label="Heat Surface" path="dimensions.heat_surface_area_m2" stored={dims.heat_surface_area_m2} unit="m²" onSave={handleSave} />
          <FieldRow label="Weight (Dry)" path="dimensions.weight_dry_kg" stored={dims.weight_dry_kg} unit="kg" onSave={handleSave} />
          <FieldRow label="Weight (Oper.)" path="dimensions.weight_operating_kg" stored={dims.weight_operating_kg} unit="kg" onSave={handleSave} />
          <FieldRow label="Weight (Flood.)" path="dimensions.weight_flooded_kg" stored={dims.weight_flooded_kg} unit="kg" onSave={handleSave} />
        </Section>

        <Section title="Tube Bundle" sectionKey="tube_bundle" pendingCount={countPending(tubes)} onConfirmAll={handleConfirmAll} accentColor="blue">
          <FieldRow label="Total Tubes" path="tube_bundle.total_tubes" stored={tubes.total_tubes} onSave={handleSave} />
          <FieldRow label="Tube Passes" path="tube_bundle.tube_passes" stored={tubes.tube_passes} onSave={handleSave} />
          <FieldRow label="Tube OD (mm)" path="tube_bundle.tube_od_mm" stored={tubes.tube_od_mm} unit="mm" onSave={handleSave} />
          <FieldRow label="Tube Thickness (mm)" path="tube_bundle.tube_thickness_mm" stored={tubes.tube_thickness_mm} unit="mm" onSave={handleSave} />
          <FieldRow label="Arrangement" path="tube_bundle.tube_arrangement" stored={tubes.tube_arrangement ?? tubes.arrangement} onSave={handleSave} />
          <FieldRow label="Baffle Type" path="tube_bundle.baffle_type" stored={tubes.baffle_type} onSave={handleSave} />
        </Section>

        <div className="grid grid-cols-2 divide-x divide-gray-100">
          {[
            { label: 'Shell Side', key: 'shell_side', d: shell, color: 'orange' as const },
            { label: 'Tube Side', key: 'tube_side', d: tube, color: 'purple' as const },
          ].map(({ label, key, d, color }) => (
            <Section key={key} title={label} sectionKey={key} pendingCount={countPending(d)} onConfirmAll={handleConfirmAll} accentColor={color} defaultOpen>
              <FieldRow label="Medium" path={`${key}.medium`} stored={d.medium} onSave={handleSave} />
              <FieldRow label="Flow Rate" path={`${key}.flow_rate`} stored={d.flow_rate} onSave={handleSave} />
              <FieldRow label="Inlet Temp" path={`${key}.inlet_temp_c`} stored={d.inlet_temp_c} unit="°C" onSave={handleSave} />
              <FieldRow label="Outlet Temp" path={`${key}.outlet_temp_c`} stored={d.outlet_temp_c} unit="°C" onSave={handleSave} />
              <FieldRow label="Design Pressure" path={`${key}.design_pressure_kg_cm2`} stored={d.design_pressure_kg_cm2} unit="kg/cm²" onSave={handleSave} />
              <FieldRow label="Test Pressure" path={`${key}.test_pressure_kg_cm2`} stored={d.test_pressure_kg_cm2} unit="kg/cm²" onSave={handleSave} />
              <FieldRow label="Design Temp" path={`${key}.design_temp_c`} stored={d.design_temp_c} unit="°C" onSave={handleSave} />
              <FieldRow label="Pressure Drop" path={`${key}.pressure_drop_kg_cm2`} stored={d.pressure_drop_kg_cm2} unit="kg/cm²" onSave={handleSave} />
              <FieldRow label="Velocity" path={`${key}.velocity_m_s`} stored={d.velocity_m_s} unit="m/s" onSave={handleSave} />
              <FieldRow label="Passes" path={`${key}.passes`} stored={d.passes} onSave={handleSave} />
            </Section>
          ))}
        </div>

        <Section title="Hydrotest Parameters" sectionKey="hydrotest" pendingCount={countPending(ht)} onConfirmAll={handleConfirmAll} accentColor="red">
          <FieldRow label="Shell Side Test Pr." path="hydrotest.shellSideTestPressure" stored={ht.shellSideTestPressure} onSave={handleSave} />
          <FieldRow label="Tube Side Test Pr." path="hydrotest.tubeSideTestPressure" stored={ht.tubeSideTestPressure} onSave={handleSave} />
          <FieldRow label="Test Medium" path="hydrotest.testMedium" stored={ht.testMedium} onSave={handleSave} />
          <FieldRow label="Hold Duration" path="hydrotest.testDuration" stored={ht.testDuration} onSave={handleSave} />
          <FieldRow label="Test Standard" path="hydrotest.testStandard" stored={ht.testStandard} onSave={handleSave} />
          <FieldRow label="Hold Pressure" path="hydrotest.holdPressure" stored={ht.holdPressure} onSave={handleSave} />
        </Section>

        {Object.keys(mats).length > 0 && (
          <Section title="Materials of Construction" sectionKey="materials" pendingCount={countPending(mats)} onConfirmAll={handleConfirmAll} accentColor="green">
            {Object.entries(mats).map(([component, material]) => (
              <FieldRow
                key={component}
                label={component.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                path={`materials.${component}`}
                stored={material}
                onSave={handleSave}
              />
            ))}
          </Section>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6">
            <h3 className="text-lg font-semibold mb-1">Re-extract Technical Data</h3>
            <p className="text-sm text-gray-500 mb-4">Server will use uploaded documents. Optionally paste text below to override.</p>
            <textarea
              value={docText}
              onChange={(e) => setDocText(e.target.value)}
              rows={8}
              placeholder="Paste datasheet text here (optional)..."
              className="w-full border border-gray-200 rounded-xl p-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {error && <p className="text-red-500 text-xs mt-2">⚠ {error}</p>}
            <div className="flex justify-end gap-3 mt-4">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExtract}
                disabled={extracting}
                className="px-5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {extracting ? '⟳ Extracting...' : '⚡ Extract Technical Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
