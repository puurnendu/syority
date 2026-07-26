'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/lib/permissions';

// ── Constants ──────────────────────────────────────────
const WORK_CATEGORIES = [
  '', 'mechanical', 'electrical', 'instrumentation', 'piping',
  'civil', 'painting', 'insulation', 'scaffolding', 'welding', 'ndt',
];
const PHASES = ['', 'handover', 'maintenance', 'takeover', 'pre_job', 'post_job'];
const HOLD_POINTS = ['', 'H', 'W', 'I', 'R'];
const INFO_DISMISS_KEY = 'aurianoa_activity_code_info_dismissed';

type ColKey = 'activity_code' | 'code' | 'description' | 'discipline' | 'duration' |
              'hold_point' | 'work_category' | 'phase' | 'level_code' |
              'active' | 'usage';

type ColDef = { key: ColKey; label: string; width: number; defaultVisible: boolean };

const ALL_COLS: ColDef[] = [
  { key: 'activity_code', label: 'Activity Code',    width: 100, defaultVisible: true  },
  { key: 'code',          label: 'Code / Name',       width: 200, defaultVisible: true  },
  { key: 'description',   label: 'Description',        width: 260, defaultVisible: true  },
  { key: 'discipline',    label: 'Discipline',         width: 130, defaultVisible: true  },
  { key: 'duration',      label: 'Dur. (hrs)',         width: 90,  defaultVisible: true  },
  { key: 'hold_point',    label: 'Hold Point',         width: 90,  defaultVisible: true  },
  { key: 'work_category', label: 'Work Category',      width: 130, defaultVisible: true  },
  { key: 'phase',         label: 'Phase',              width: 110, defaultVisible: true  },
  { key: 'level_code',    label: 'Level Code',         width: 120, defaultVisible: true  },
  { key: 'active',        label: 'Active',             width: 70,  defaultVisible: true  },
  { key: 'usage',         label: 'Usage',              width: 70,  defaultVisible: true  },
];

type LibItem = {
  id: string;
  name: string;
  activity_code: string | null;
  description: string | null;
  discipline_id: string | null;
  discipline?: { id: string; name: string; code: string; color: string | null } | null;
  duration_hours: number | null;
  hold_point_type: string | null;
  work_category: string | null;
  phase: string | null;
  level_code: string | null;
  is_active: boolean | null;
  _usageCount: number;
};

type EditCell = { id: string; col: ColKey };

// ── Paste parser ────────────────────────────────────────
// Expected columns: Code, Description, Discipline, Duration,
//                   HoldPoint, WorkCategory, Phase, LevelCode
function parsePasteRows(text: string) {
  return text.trim().split('\n')
    .filter(l => l.trim())
    .map(line => {
      const p = line.split(/\t|,/).map(s => s.trim().replace(/^"|"$/g, ''));
      return {
        name:           p[0] ?? '',
        description:    p[1] ?? '',
        discipline_code: p[2] ?? '',
        duration_hours: parseFloat(p[3] ?? '') || 0,
        hold_point_type: p[4] ?? '',
        work_category:  p[5] ?? '',
        phase:          p[6] ?? '',
        level_code:     p[7] ?? '',
      };
    })
    .filter(r => r.name.trim());
}

export default function ActivityCodesPage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const rawRole = user?.role ?? user?.roles?.[0] ?? '';
  const role = String(rawRole).toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  
  const isPlatformAdmin = 
    role === 'super_admin' || 
    role === 'org_admin' ||
    role.includes('super') || 
    role.includes('admin') ||
    user?.is_super_admin === true || 
    user?.isSuperAdmin === true;

  const canEdit = isPlatformAdmin || hasPermission(role, 'masterdata.activity_codes.edit');

  // ── Data state ─────────────────────────────────────
  const [items, setItems] = useState<LibItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [disciplines, setDisciplines] = useState<any[]>([]);
  const [levelCodeOptions, setLevelCodeOptions] = useState<{ id: string; code_value: string; label: string }[]>([]);
  const [search, setSearch] = useState('');
  const [filterDiscipline, setFilterDiscipline] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active');

  // ── UI state ────────────────────────────────────────
  const [showInfoBanner, setShowInfoBanner] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(
    new Set(ALL_COLS.filter(c => c.defaultVisible).map(c => c.key))
  );
  const [showColPicker, setShowColPicker] = useState(false);
  const [colWidths, setColWidths] = useState<Record<string, number>>(
    Object.fromEntries(ALL_COLS.map(c => [c.key, c.width]))
  );
  const [editCell, setEditCell] = useState<EditCell | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState<string | null>(null); // item id being saved
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ── Add row state ───────────────────────────────────
  const [showAddRow, setShowAddRow] = useState(false);
  const [newRow, setNewRow] = useState({
    name: '', description: '', discipline_id: '',
    duration_hours: '', hold_point_type: '',
    work_category: '', phase: '', level_code: '', is_active: true,
  });
  const [addSaving, setAddSaving] = useState(false);

  // ── Paste state ─────────────────────────────────────
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pastePreview, setPastePreview] = useState<ReturnType<typeof parsePasteRows>>([]);
  const [pasteImporting, setPasteImporting] = useState(false);

  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  // ── Fetch ───────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, discRes, udfRes] = await Promise.all([
        fetch('/api/settings/master-data/activity-codes').then(r => r.json()),
        fetch('/api/settings/master-data/disciplines').then(r => r.json()),
        fetch('/api/master-data/udf-definitions').then(r => r.json()),
      ]);
      setItems(Array.isArray(itemsRes) ? itemsRes : []);
      setDisciplines(Array.isArray(discRes) ? discRes : []);
      // Extract level_code UDF options
      const levelDef = (Array.isArray(udfRes) ? udfRes : [])
        .find((d: any) => d.code === 'level_code');
      setLevelCodeOptions(
        (levelDef?.options ?? [])
          .filter((o: any) => o.is_active !== false)
          .map((o: any) => ({
            id: o.id,
            code_value: o.code_value ?? o.value ?? '',
            label: o.label ?? o.description ?? o.code_value ?? '',
          }))
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    try { setShowInfoBanner(!localStorage.getItem(INFO_DISMISS_KEY)); } catch {}
  }, []);
  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 3000);
    return () => clearTimeout(t);
  }, [successMsg]);

  // ── Filtered items ──────────────────────────────────
  const filtered = items.filter(item => {
    if (filterActive === 'active' && !item.is_active) return false;
    if (filterActive === 'inactive' && item.is_active) return false;
    if (filterDiscipline && item.discipline?.code !== filterDiscipline) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      return (
        item.name?.toLowerCase().includes(s) ||
        item.description?.toLowerCase().includes(s) ||
        item.discipline?.code?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  // ── Column resize ───────────────────────────────────
  const startResize = (e: React.MouseEvent, key: string) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const startW = colWidths[key] ?? 100;
    const onMove = (ev: MouseEvent) => {
      setColWidths(prev => ({ ...prev, [key]: Math.max(50, startW + ev.clientX - startX) }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── Inline edit ─────────────────────────────────────
  const startEdit = (item: LibItem, col: ColKey) => {
    if (!canEdit) return;
    if (col === 'usage' || col === 'activity_code') return;
    const val = (() => {
      switch (col) {
        case 'code': return item.name ?? '';
        case 'description': return item.description ?? '';
        case 'discipline': return item.discipline_id ?? '';
        case 'duration': return String(item.duration_hours ?? '');
        case 'hold_point': return item.hold_point_type ?? '';
        case 'work_category': return item.work_category ?? '';
        case 'phase': return item.phase ?? '';
        case 'level_code': return item.level_code ?? '';
        case 'active': return item.is_active ? 'true' : 'false';
        default: return '';
      }
    })();
    setEditCell({ id: item.id, col });
    setEditValue(val);
    setTimeout(() => inputRef.current?.focus(), 20);
  };

  const saveEdit = async () => {
    if (!editCell) return;
    const { id, col } = editCell;
    setEditCell(null);
    const item = items.find(i => i.id === id);
    if (!item) return;

    const fieldMap: Record<ColKey, string> = {
      activity_code: '', code: 'name', description: 'description', discipline: 'discipline_id',
      duration: 'duration_hours', hold_point: 'hold_point_type',
      work_category: 'work_category', phase: 'phase',
      level_code: 'level_code', active: 'is_active', usage: '',
    };
    const field = fieldMap[col];
    if (!field) return;

    let value: any = editValue;
    if (col === 'duration') value = parseFloat(editValue) || 0;
    if (col === 'active') value = editValue === 'true';
    if (col === 'discipline' && editValue === '') value = null;

    setSaving(id);
    try {
      const res = await fetch('/api/settings/master-data/activity-codes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
      setSuccessMsg('Saved');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
    if (e.key === 'Escape') { setEditCell(null); }
  };

  // ── Add new row ─────────────────────────────────────
  const handleAddSave = async () => {
    if (!newRow.name.trim()) { setError('Code / Name is required'); return; }
    setAddSaving(true); setError(null);
    try {
      const res = await fetch('/api/settings/master-data/activity-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRow.name.trim(),
          description: newRow.description.trim() || null,
          discipline_id: newRow.discipline_id || null,
          duration_hours: parseFloat(newRow.duration_hours) || 0,
          hold_point_type: newRow.hold_point_type || null,
          work_category: newRow.work_category || null,
          phase: newRow.phase || null,
          level_code: newRow.level_code || null,
          is_active: newRow.is_active,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? data.detail ?? 'Create failed');
      setShowAddRow(false);
      setNewRow({
        name: '', description: '', discipline_id: '',
        duration_hours: '', hold_point_type: '',
        work_category: '', phase: '', level_code: '', is_active: true,
      });
      setSuccessMsg('Activity code created');
      fetchData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAddSaving(false);
    }
  };

  // ── Paste import ────────────────────────────────────
  const handlePasteImport = async () => {
    if (pastePreview.length === 0) return;
    setPasteImporting(true); setError(null);
    let created = 0; let failed = 0;
    for (const row of pastePreview) {
      const disc = disciplines.find(
        d => d.code?.toLowerCase() === row.discipline_code.toLowerCase() ||
             d.name?.toLowerCase() === row.discipline_code.toLowerCase()
      );
      try {
        const res = await fetch('/api/settings/master-data/activity-codes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: row.name,
            description: row.description || null,
            discipline_id: disc?.id ?? null,
            duration_hours: row.duration_hours,
            hold_point_type: row.hold_point_type || null,
            work_category: row.work_category || null,
            phase: row.phase || null,
            level_code: row.level_code || null,
            is_active: true,
          }),
        });
        if (res.ok) created++; else failed++;
      } catch { failed++; }
    }
    setPasteImporting(false);
    setShowPaste(false);
    setPasteText('');
    setPastePreview([]);
    setSuccessMsg(`Imported ${created} codes${failed > 0 ? `, ${failed} failed` : ''}`);
    fetchData();
  };

  // ── Cell display ────────────────────────────────────
  const getCellDisplay = (item: LibItem, col: ColKey) => {
    const isEditing = editCell?.id === item.id && editCell?.col === col;
    const edCls = "w-full px-1 py-0.5 text-[11px] border border-blue-400 rounded bg-blue-50 focus:outline-none";

    if (isEditing) {
      if (col === 'discipline') return (
        <select
          ref={inputRef as any} value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={saveEdit} onKeyDown={handleKeyDown}
          className={edCls}
        >
          <option value="">— None —</option>
          {disciplines.map(d => (
            <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
          ))}
        </select>
      );
      if (col === 'hold_point') return (
        <select ref={inputRef as any} value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={saveEdit} onKeyDown={handleKeyDown} className={edCls}>
          {HOLD_POINTS.map(h => <option key={h} value={h}>{h || '—'}</option>)}
        </select>
      );
      if (col === 'work_category') return (
        <select ref={inputRef as any} value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={saveEdit} onKeyDown={handleKeyDown} className={edCls}>
          {WORK_CATEGORIES.map(w => (
            <option key={w} value={w}>{w || '—'}</option>
          ))}
        </select>
      );
      if (col === 'phase') return (
        <select ref={inputRef as any} value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={saveEdit} onKeyDown={handleKeyDown} className={edCls}>
          {PHASES.map(p => <option key={p} value={p}>{p || '—'}</option>)}
        </select>
      );
      if (col === 'level_code') return (
        <select ref={inputRef as any} value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={saveEdit} onKeyDown={handleKeyDown} className={edCls}>
          <option value="">—</option>
          {levelCodeOptions.map(o => (
            <option key={o.id} value={o.code_value}>
              {o.code_value} / {o.label}
            </option>
          ))}
        </select>
      );
      if (col === 'active') return (
        <select ref={inputRef as any} value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={saveEdit} onKeyDown={handleKeyDown} className={edCls}>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      );
      return (
        <input
          ref={inputRef as any} type={col === 'duration' ? 'number' : 'text'}
          value={editValue} onChange={e => setEditValue(e.target.value)}
          onBlur={saveEdit} onKeyDown={handleKeyDown}
          className={edCls} step={col === 'duration' ? '0.5' : undefined}
        />
      );
    }

    // Display mode
    switch (col) {
      case 'activity_code':
        return item.activity_code ? (
          <span className="inline-flex px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded text-[11px] font-mono font-bold">
            {item.activity_code}
          </span>
        ) : (
          <span className="text-gray-300 text-[11px]">—</span>
        );
      case 'code':
        return (
          <span className="font-mono text-[12px] font-semibold text-gray-800">
            {item.name}
          </span>
        );
      case 'description':
        return (
          <span className="text-[12px] text-gray-700 truncate block" title={item.description ?? ''}>
            {item.description || <span className="text-gray-300 italic">—</span>}
          </span>
        );
      case 'discipline':
        return item.discipline ? (
          <span className="inline-flex items-center gap-1.5 text-[11px]">
            {item.discipline.color && (
              <span className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.discipline.color }} />
            )}
            <span className="font-medium text-gray-700">{item.discipline.code}</span>
          </span>
        ) : <span className="text-gray-300 text-[11px]">—</span>;
      case 'duration':
        return (
          <span className="text-[12px] font-mono text-gray-700">
            {item.duration_hours != null ? Number(item.duration_hours).toFixed(1) : '—'}
          </span>
        );
      case 'hold_point':
        if (!item.hold_point_type) return <span className="text-gray-300 text-[11px]">—</span>;
        return (
          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
            item.hold_point_type === 'H' ? 'bg-red-100 text-red-700' :
            item.hold_point_type === 'W' ? 'bg-amber-100 text-amber-700' :
            'bg-gray-100 text-gray-700'
          }`}>{item.hold_point_type}</span>
        );
      case 'work_category':
        return (
          <span className="text-[11px] text-gray-600 capitalize">
            {item.work_category || <span className="text-gray-300">—</span>}
          </span>
        );
      case 'phase':
        return (
          <span className="text-[11px] text-gray-600 capitalize">
            {item.phase?.replace(/_/g, ' ') || <span className="text-gray-300">—</span>}
          </span>
        );
      case 'level_code': {
        if (!item.level_code) return <span className="text-gray-300 text-[11px]">—</span>;
        const opt = levelCodeOptions.find(o => o.code_value === item.level_code);
        return (
          <span className="inline-flex px-2 py-0.5 bg-indigo-50 border border-indigo-100
                           text-indigo-700 rounded text-[10px] font-mono">
            {item.level_code}
            {opt && opt.label !== item.level_code && (
              <span className="ml-1 text-indigo-400 font-normal">/ {opt.label}</span>
            )}
          </span>
        );
      }
      case 'active':
        return (
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
            item.is_active ? 'text-green-600' : 'text-gray-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              item.is_active ? 'bg-green-500' : 'bg-gray-300'
            }`} />
            {item.is_active ? 'Active' : 'Inactive'}
          </span>
        );
      case 'usage':
        return (
          <span className="text-[11px] text-gray-500 font-mono">
            {item._usageCount ?? 0}
          </span>
        );
      default: return null;
    }
  };

  const visibleColDefs = ALL_COLS.filter(c => visibleCols.has(c.key));
  // ── Render ──────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Info banner */}
      {showInfoBanner && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 relative">
          <h3 className="text-sm font-semibold text-blue-900 mb-1">
            What are Activity Codes?
          </h3>
          <p className="text-sm text-blue-800">
            Standard library of work tasks. Each code carries description, discipline,
            duration, hold points and default resources. When assigned to an activity
            these auto-fill — enabling cross-workpack reporting.
          </p>
          <button
            type="button"
            onClick={() => {
              try { localStorage.setItem(INFO_DISMISS_KEY, '1'); } catch {}
              setShowInfoBanner(false);
            }}
            className="absolute top-3 right-3 text-blue-500 hover:text-blue-700 text-xs font-medium"
          >
            Got it ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Activity Codes Library</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {filtered.length} codes · Double-click any cell to edit
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPaste(v => !v)}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg
                         hover:bg-gray-50 text-gray-600 flex items-center gap-1.5"
            >
              📋 Paste from Excel
            </button>
            <button
              type="button"
              onClick={() => { setShowAddRow(true); setError(null); }}
              className="px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold
                         rounded-lg hover:bg-blue-700 shadow-sm"
            >
              + Add Activity Code
            </button>
          </div>
        )}
      </div>

      {/* Toast */}
      {successMsg && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-2 bg-gray-900
                        text-white text-sm rounded-lg shadow-lg">
          ✓ {successMsg}
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm
                        text-red-700 flex items-center gap-2">
          <span>⚠</span><span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Paste panel */}
      {showPaste && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-800 mb-1">
            Paste from Excel / CSV — columns in order:
          </p>
          <p className="text-[11px] text-amber-600 font-mono mb-2">
            Code | Description | Discipline | Duration | HoldPoint | WorkCategory | Phase | LevelCode
          </p>
          <textarea
            className="w-full h-28 px-3 py-2 text-xs font-mono border border-amber-200
                       rounded-lg resize-none focus:outline-none focus:ring-2
                       focus:ring-amber-400 bg-white"
            placeholder={"E-421-001\tFlange Inspection\tMECH\t8\tH\tmechanical\tmaintenance\tPIP.ERE"}
            value={pasteText}
            onChange={e => {
              setPasteText(e.target.value);
              setPastePreview(parsePasteRows(e.target.value));
            }}
            autoFocus
          />
          {pastePreview.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] font-semibold text-amber-700 mb-2">
                Preview — {pastePreview.length} rows:
              </p>
              <div className="overflow-x-auto max-h-40 border border-amber-100 rounded-lg">
                <table className="w-full text-[11px] border-collapse">
                  <thead className="bg-amber-100/60 sticky top-0">
                    <tr>
                      {['Code','Description','Discipline','Hrs','HP','Category','Phase','Level'].map(h => (
                        <th key={h} className="px-2 py-1 text-left font-medium text-amber-800">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pastePreview.map((r, i) => (
                      <tr key={i} className="border-t border-amber-100">
                        <td className="px-2 py-1 font-mono font-bold">{r.name}</td>
                        <td className="px-2 py-1 text-gray-600 max-w-[150px] truncate">{r.description}</td>
                        <td className="px-2 py-1">{r.discipline_code}</td>
                        <td className="px-2 py-1">{r.duration_hours || '—'}</td>
                        <td className="px-2 py-1">{r.hold_point_type || '—'}</td>
                        <td className="px-2 py-1">{r.work_category || '—'}</td>
                        <td className="px-2 py-1">{r.phase || '—'}</td>
                        <td className="px-2 py-1">{r.level_code || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={handlePasteImport}
                  disabled={pasteImporting}
                  className="text-xs px-4 py-1.5 bg-amber-600 text-white rounded-lg
                             hover:bg-amber-700 disabled:opacity-50 font-medium"
                >
                  {pasteImporting ? 'Importing…' : `✓ Import ${pastePreview.length} rows`}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowPaste(false); setPasteText(''); setPastePreview([]); }}
                  className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toolbar: search + filters + column toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Search codes, descriptions..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-blue-400 w-56"
        />
        <select
          value={filterDiscipline}
          onChange={e => setFilterDiscipline(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg
                     focus:outline-none bg-white"
        >
          <option value="">All Disciplines</option>
          {disciplines.map(d => (
            <option key={d.id} value={d.code}>{d.code} — {d.name}</option>
          ))}
        </select>
        <select
          value={filterActive}
          onChange={e => setFilterActive(e.target.value as any)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg
                     focus:outline-none bg-white"
        >
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
          <option value="all">All</option>
        </select>

        <div className="ml-auto relative">
          <button
            type="button"
            onClick={() => setShowColPicker(v => !v)}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg
                       hover:bg-gray-50 text-gray-600 flex items-center gap-1"
          >
            ⚙ Columns
          </button>
          {showColPicker && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowColPicker(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 bg-white border
                              border-gray-200 rounded-xl shadow-xl p-3 w-52">
                <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">
                  Show / Hide Columns
                </p>
                {ALL_COLS.map(col => (
                  <label key={col.key}
                         className="flex items-center gap-2 py-1 cursor-pointer
                                    hover:bg-gray-50 px-1 rounded text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={visibleCols.has(col.key)}
                      onChange={() => {
                        setVisibleCols(prev => {
                          const next = new Set(prev);
                          next.has(col.key) ? next.delete(col.key) : next.add(col.key);
                          return next;
                        });
                      }}
                      className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5"
                    />
                    {col.label}
                  </label>
                ))}
                <div className="border-t border-gray-100 mt-2 pt-2 flex gap-3">
                  <button
                    onClick={() => setVisibleCols(new Set(ALL_COLS.map(c => c.key)))}
                    className="text-xs text-blue-600 hover:underline"
                  >Show All</button>
                  <button
                    onClick={() => setVisibleCols(new Set(ALL_COLS.filter(c => c.defaultVisible).map(c => c.key)))}
                    className="text-xs text-gray-500 hover:underline"
                  >Reset</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="bg-white border border-gray-300 shadow-sm overflow-hidden">
        <div style={{ height: 'calc(100vh - 320px)', overflow: 'auto' }}>
          <table className="w-full text-xs border-collapse" style={{ minWidth: '800px' }}>
            <thead className="sticky top-0 z-20">
              <tr className="border-b-2 border-gray-300">
                <th className="w-8 bg-[#e8e8e8] border-r border-gray-300 px-2 py-2
                               text-[10px] font-semibold text-gray-500 select-none">#</th>
                {visibleColDefs.map((col, i) => (
                  <th
                    key={col.key}
                    className="relative bg-[#f0f0f0] border-r border-gray-300
                               px-2 py-2 text-left text-[11px] font-semibold
                               text-gray-600 uppercase tracking-wide select-none
                               whitespace-nowrap"
                    style={{ width: colWidths[col.key] ?? col.width, minWidth: 50 }}
                  >
                    {col.label}
                    <div
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize
                                 flex items-center justify-center group"
                      onMouseDown={e => startResize(e, col.key)}
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="w-px h-4 bg-gray-400 group-hover:bg-blue-500" />
                    </div>
                  </th>
                ))}
                {canEdit && (
                  <th className="bg-[#f0f0f0] w-8 px-2 py-2" />
                )}
              </tr>
            </thead>
            <tbody>
              {/* Add row inline */}
              {showAddRow && canEdit && (
                <tr className="border-b-2 border-blue-300 bg-blue-50/40">
                  <td className="px-2 py-1 text-gray-400 text-center text-[10px]
                                 border-r border-gray-200 font-mono">new</td>
                  {visibleColDefs.map(col => (
                    <td key={col.key} className="px-1 py-1 border-r border-gray-200">
                      {col.key === 'activity_code' && (
                        <span className="text-gray-400 text-[11px] italic">Auto</span>
                      )}
                      {col.key === 'code' && (
                        <input autoFocus type="text" value={newRow.name}
                          onChange={e => setNewRow(r => ({ ...r, name: e.target.value }))}
                          className="w-full px-2 py-1 text-[11px] border border-blue-300
                                     rounded font-mono bg-white focus:outline-none
                                     focus:ring-1 focus:ring-blue-400"
                          placeholder="E-421-001" />
                      )}
                      {col.key === 'description' && (
                        <input type="text" value={newRow.description}
                          onChange={e => setNewRow(r => ({ ...r, description: e.target.value }))}
                          className="w-full px-2 py-1 text-[11px] border border-blue-300
                                     rounded bg-white focus:outline-none focus:ring-1
                                     focus:ring-blue-400"
                          placeholder="Task description" />
                      )}
                      {col.key === 'discipline' && (
                        <select value={newRow.discipline_id}
                          onChange={e => setNewRow(r => ({ ...r, discipline_id: e.target.value }))}
                          className="w-full px-1 py-1 text-[11px] border border-blue-300
                                     rounded bg-white focus:outline-none">
                          <option value="">—</option>
                          {disciplines.map(d => (
                            <option key={d.id} value={d.id}>{d.code}</option>
                          ))}
                        </select>
                      )}
                      {col.key === 'duration' && (
                        <input type="number" step="0.5" value={newRow.duration_hours}
                          onChange={e => setNewRow(r => ({ ...r, duration_hours: e.target.value }))}
                          className="w-full px-2 py-1 text-[11px] border border-blue-300
                                     rounded bg-white focus:outline-none"
                          placeholder="8" />
                      )}
                      {col.key === 'hold_point' && (
                        <select value={newRow.hold_point_type}
                          onChange={e => setNewRow(r => ({ ...r, hold_point_type: e.target.value }))}
                          className="w-full px-1 py-1 text-[11px] border border-blue-300
                                     rounded bg-white focus:outline-none">
                          {HOLD_POINTS.map(h => <option key={h} value={h}>{h || '—'}</option>)}
                        </select>
                      )}
                      {col.key === 'work_category' && (
                        <select value={newRow.work_category}
                          onChange={e => setNewRow(r => ({ ...r, work_category: e.target.value }))}
                          className="w-full px-1 py-1 text-[11px] border border-blue-300
                                     rounded bg-white focus:outline-none">
                          {WORK_CATEGORIES.map(w => (
                            <option key={w} value={w}>{w || '—'}</option>
                          ))}
                        </select>
                      )}
                      {col.key === 'phase' && (
                        <select value={newRow.phase}
                          onChange={e => setNewRow(r => ({ ...r, phase: e.target.value }))}
                          className="w-full px-1 py-1 text-[11px] border border-blue-300
                                     rounded bg-white focus:outline-none">
                          {PHASES.map(p => <option key={p} value={p}>{p || '—'}</option>)}
                        </select>
                      )}
                      {col.key === 'level_code' && (
                        <select value={newRow.level_code}
                          onChange={e => setNewRow(r => ({ ...r, level_code: e.target.value }))}
                          className="w-full px-1 py-1 text-[11px] border border-blue-300
                                     rounded bg-white focus:outline-none">
                          <option value="">—</option>
                          {levelCodeOptions.map(o => (
                            <option key={o.id} value={o.code_value}>
                              {o.code_value} / {o.label}
                            </option>
                          ))}
                        </select>
                      )}
                      {col.key === 'active' && (
                        <select value={newRow.is_active ? 'true' : 'false'}
                          onChange={e => setNewRow(r => ({ ...r, is_active: e.target.value === 'true' }))}
                          className="w-full px-1 py-1 text-[11px] border border-blue-300
                                     rounded bg-white focus:outline-none">
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                        </select>
                      )}
                      {col.key === 'usage' && (
                        <span className="text-gray-300 text-[11px] px-2">—</span>
                      )}
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={handleAddSave} disabled={addSaving}
                        className="px-2 py-1 bg-blue-600 text-white text-[10px] rounded
                                   hover:bg-blue-700 disabled:opacity-50 font-medium">
                        {addSaving ? '…' : '✓'}
                      </button>
                      <button type="button" onClick={() => { setShowAddRow(false); setError(null); }}
                        className="px-2 py-1 text-gray-400 hover:text-gray-600 text-[10px]
                                   rounded border border-gray-200 hover:bg-gray-50">
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {loading ? (
                <tr>
                  <td colSpan={visibleColDefs.length + 2}
                      className="py-12 text-center text-gray-400 text-sm">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={visibleColDefs.length + 2}
                      className="py-12 text-center text-gray-400 text-sm">
                    {items.length === 0
                      ? 'No activity codes yet. Click + Add or paste from Excel.'
                      : 'No results match your filters.'}
                  </td>
                </tr>
              ) : filtered.map((item, idx) => (
                <tr
                  key={item.id}
                  className={`border-b border-[#e0e0e0] group transition-colors ${
                    (item._usageCount ?? 0) === 0
                      ? idx % 2 === 0
                        ? 'bg-orange-50/60 hover:bg-orange-50'
                        : 'bg-orange-50/40 hover:bg-orange-50'
                      : idx % 2 === 0
                        ? 'bg-white hover:bg-[#f5f9ff]'
                        : 'bg-[#f8f8f8] hover:bg-[#f0f5ff]'
                  } ${!item.is_active ? 'opacity-60' : ''}`}
                >
                  <td className="px-2 py-1 text-[11px] text-gray-400 font-mono
                                 text-center border-r border-gray-200 select-none">
                    {idx + 1}
                  </td>
                  {visibleColDefs.map(col => (
                    <td
                      key={col.key}
                      className={`py-1 px-2 border-r border-[#e0e0e0]
                        ${col.key !== 'usage' && col.key !== 'activity_code' && canEdit ? 'cursor-text hover:bg-blue-50/40' : ''}
                        ${editCell?.id === item.id && editCell?.col === col.key
                          ? 'bg-blue-50 ring-1 ring-inset ring-blue-400' : ''}`}
                      onDoubleClick={() => startEdit(item, col.key)}
                      title={col.key !== 'usage' && col.key !== 'activity_code' && canEdit ? 'Double-click to edit' : ''}
                    >
                      {saving === item.id && editCell === null
                        ? <span className="text-gray-300 text-[10px]">saving…</span>
                        : getCellDisplay(item, col.key)
                      }
                    </td>
                  ))}
                  {canEdit && (
                    <td className="px-1 py-1 whitespace-nowrap">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          type="button"
                          onClick={() => startEdit(item, 'code')}
                          className="p-1 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded"
                          title="Edit"
                        >
                          ✏
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === item.id}
                          onClick={async () => {
                            if (!confirm(`Delete activity code "${item.name}"? This cannot be undone.`)) return;
                            setDeletingId(item.id);
                            setError(null);
                            try {
                              const res = await fetch(
                                `/api/settings/master-data/activity-codes?id=${item.id}`,
                                { method: 'DELETE' }
                              );
                              if (!res.ok) {
                                const d = await res.json().catch(() => ({}));
                                throw new Error(d.error ?? 'Delete failed');
                              }
                              setItems(prev => prev.filter(i => i.id !== item.id));
                              setSuccessMsg('Activity code deleted');
                            } catch (e: any) {
                              setError(e.message);
                            } finally {
                              setDeletingId(null);
                            }
                          }}
                          className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded disabled:opacity-50"
                          title="Delete"
                        >
                          {deletingId === item.id ? '…' : '🗑'}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-[#f0f0f0] border-t-2 border-gray-300
                        flex items-center justify-between flex-wrap gap-2">
          <div className="text-[11px] text-gray-600 flex items-center gap-4 flex-wrap">
            <span>
              <strong>{filtered.length}</strong>
              <span className="text-gray-400"> of {items.length} codes</span>
            </span>
            <span className="text-gray-300">·</span>
            <span>
              <strong className="text-green-600">
                {items.filter(i => i.is_active).length}
              </strong>
              <span className="text-gray-400"> active</span>
            </span>
            <span className="text-gray-300">·</span>
            <span>
              <strong className="text-gray-500">
                {items.filter(i => !i.is_active).length}
              </strong>
              <span className="text-gray-400"> inactive</span>
            </span>
            <span className="text-gray-300">·</span>
            <span>
              <strong>
                {new Set(items.map(i => i.discipline?.code).filter(Boolean)).size}
              </strong>
              <span className="text-gray-400"> disciplines</span>
            </span>
            {items.filter(i => (i._usageCount ?? 0) === 0).length > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                  <strong className="text-orange-600">
                    {items.filter(i => (i._usageCount ?? 0) === 0).length}
                  </strong>
                  <span className="text-orange-500"> never used</span>
                </span>
              </>
            )}
          </div>
          <div className="text-[11px] text-gray-400">
            Double-click to edit · Enter to save · Esc to cancel
          </div>
        </div>
      </div>
    </div>
  );
}
