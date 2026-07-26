'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission, type Permission } from '@/lib/permissions';
import { normalizeRole } from '@/security/scopes';
import { Can } from '@/components/auth/Can';

export type HierarchyLevel = 'sites' | 'plants' | 'areas' | 'units' | 'systems' | 'assets';

type ParentOption = { id: string; label: string };

type Row = {
  id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  tag_number?: string;
  is_active?: boolean | null;
  deleted_at?: string | null;
  location?: string | null;
  site?: { id: string; name: string; code?: string | null };
  plant?: { id: string; name: string; code?: string | null };
  area?: { id: string; name: string; code?: string | null };
  unit?: { id: string; name: string; code?: string | null };
  system?: { id: string; name: string; code?: string | null };
  Site?: { id: string; name: string; code?: string | null };
  area_id?: string | null;
  plant_id?: string | null;
};

const CONFIG: Record<
  HierarchyLevel,
  {
    title: string;
    subtitle: string;
    api: string;
    entity: string;
    viewPermission: Permission;
    managePermission: Permission;
    parentLabel?: string;
    parentApi?: string;
    parentField?: string;
    codeLabel?: string;
  }
> = {
  sites: {
    title: 'Sites',
    subtitle: 'Physical locations owned by this tenant (one site ≈ one plant complex).',
    api: '/api/hierarchy/sites',
    entity: 'site',
    viewPermission: 'site.view',
    managePermission: 'site.manage',
    codeLabel: 'Code',
  },
  plants: {
    title: 'Plants',
    subtitle: 'Process plants under a site — e.g. CDU, FCC, Utilities.',
    api: '/api/hierarchy/plants',
    entity: 'plant',
    viewPermission: 'plant.view',
    managePermission: 'plant.manage',
    parentLabel: 'Site',
    parentApi: '/api/hierarchy/sites?pageSize=100&status=active',
    parentField: 'site_id',
  },
  areas: {
    title: 'Areas',
    subtitle: 'Optional zones within a plant (e.g. Offsites, Tank Farm).',
    api: '/api/hierarchy/areas',
    entity: 'area',
    viewPermission: 'area.view',
    managePermission: 'area.manage',
    parentLabel: 'Plant',
    parentApi: '/api/hierarchy/plants?pageSize=100&status=active',
    parentField: 'plant_id',
  },
  units: {
    title: 'Units',
    subtitle: 'Process units under a plant (optionally under an area). Codes unique per plant.',
    api: '/api/hierarchy/units',
    entity: 'unit',
    viewPermission: 'unit.view',
    managePermission: 'unit.manage',
    parentLabel: 'Plant',
    parentApi: '/api/hierarchy/plants?pageSize=100&status=active',
    parentField: 'plant_id',
  },
  systems: {
    title: 'Systems',
    subtitle: 'Process systems under a unit — primary Workpack attachment level.',
    api: '/api/hierarchy/systems',
    entity: 'system',
    viewPermission: 'system.view',
    managePermission: 'system.manage',
    parentLabel: 'Unit',
    parentApi: '/api/hierarchy/units?pageSize=100&status=active',
    parentField: 'unit_id',
  },
  assets: {
    title: 'Assets / Equipment',
    subtitle: 'Tagged equipment under a system (or unit). Tag unique per organization.',
    api: '/api/hierarchy/assets',
    entity: 'asset',
    viewPermission: 'asset.view',
    managePermission: 'asset.manage',
    parentLabel: 'System',
    parentApi: '/api/hierarchy/systems?pageSize=100&status=active',
    parentField: 'system_id',
    codeLabel: 'Tag',
  },
};

function statusBadge(row: Row) {
  if (row.deleted_at) {
    return (
      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
        Archived
      </span>
    );
  }
  if (row.is_active === false) {
    return (
      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700">
        Inactive
      </span>
    );
  }
  return (
    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700">
      Active
    </span>
  );
}

export function HierarchyCrudPage({ level }: { level: HierarchyLevel }) {
  const cfg = CONFIG[level];
  const { data: session } = useSession();
  const roles = useMemo(() => {
    const user = session?.user as { role?: string; roles?: string[] } | undefined;
    return [
      ...new Set(
        [normalizeRole(user?.role || ''), ...((user?.roles || []).map(normalizeRole))].filter(
          Boolean
        )
      ),
    ];
  }, [session]);
  const canManage = roles.some((r) => hasPermission(r, cfg.managePermission));

  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [loading, setLoading] = useState(true);
  const [parents, setParents] = useState<ParentOption[]>([]);
  const [areas, setAreas] = useState<ParentOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    parent_id: '',
    area_id: '',
    location: '',
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      status,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    });
    const res = await fetch(`${cfg.api}?${qs}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to load');
      setItems([]);
      setTotal(0);
    } else {
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }, [cfg.api, page, pageSize, debouncedSearch, status]);

  const loadParents = useCallback(async () => {
    if (!cfg.parentApi) return;
    const res = await fetch(cfg.parentApi);
    const data = await res.json();
    const list = (data.items ?? data ?? []) as Array<{
      id: string;
      name: string;
      code?: string | null;
      site?: { name: string };
    }>;
    setParents(
      list.map((p) => ({
        id: p.id,
        label: `${p.code ? p.code + ' — ' : ''}${p.name}${p.site ? ` (${p.site.name})` : ''}`,
      }))
    );
  }, [cfg.parentApi]);

  const loadAreasForPlant = useCallback(async (plantId: string) => {
    if (!plantId) {
      setAreas([]);
      return;
    }
    const res = await fetch(
      `/api/hierarchy/areas?pageSize=100&status=active&plantId=${encodeURIComponent(plantId)}`
    );
    const data = await res.json();
    const list = (data.items ?? []) as Array<{ id: string; name: string; code?: string | null }>;
    setAreas(
      list.map((a) => ({
        id: a.id,
        label: `${a.code ? a.code + ' — ' : ''}${a.name}`,
      }))
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadParents();
  }, [loadParents]);

  useEffect(() => {
    if (level === 'units' && form.parent_id) loadAreasForPlant(form.parent_id);
  }, [level, form.parent_id, loadAreasForPlant]);

  const resetForm = () => {
    setForm({ code: '', name: '', description: '', parent_id: '', area_id: '', location: '' });
    setEditingId(null);
    setShowForm(false);
    setAreas([]);
  };

  const save = async () => {
    if (!canManage || !form.name.trim()) return;
    setSaving(true);
    setError(null);
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      description: form.description.trim() || null,
    };
    if (level === 'sites') payload.location = form.location.trim() || null;
    if (level === 'assets') payload.tag_number = form.code.trim();
    if (cfg.parentField && form.parent_id) payload[cfg.parentField] = form.parent_id;
    if (level === 'units') payload.area_id = form.area_id || null;

    const url = editingId ? `${cfg.api}/${editingId}` : cfg.api;
    const method = editingId ? 'PATCH' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || 'Save failed');
      return;
    }
    resetForm();
    load();
  };

  const startEdit = (row: Row) => {
    if (!canManage) return;
    let parentId = '';
    if (level === 'plants') parentId = row.site?.id || '';
    else if (level === 'areas') parentId = row.plant?.id || row.plant_id || '';
    else if (level === 'units') parentId = row.plant?.id || row.plant_id || '';
    else if (level === 'systems') parentId = row.unit?.id || '';
    else if (level === 'assets') parentId = row.system?.id || '';

    setEditingId(row.id);
    setForm({
      code: row.tag_number || row.code || '',
      name: row.name,
      description: row.description || '',
      parent_id: parentId,
      area_id: row.area?.id || row.area_id || '',
      location: row.location || '',
    });
    setShowForm(true);
  };

  const archive = async (id: string) => {
    if (!canManage) return;
    if (!confirm('Archive this record? It can be restored later.')) return;
    const res = await fetch(`${cfg.api}/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Archive failed');
      return;
    }
    load();
  };

  const restore = async (id: string) => {
    if (!canManage) return;
    const res = await fetch(`${cfg.api}/${id}/restore`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Restore failed');
      return;
    }
    load();
  };

  const onImport = async (file: File, dryRun: boolean) => {
    if (!canManage) return;
    setImportMsg(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('entity', cfg.entity);
    fd.append('dryRun', dryRun ? 'true' : 'false');
    const res = await fetch('/api/hierarchy/import', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) {
      setImportMsg(data.error || 'Import failed');
      return;
    }
    if (dryRun) {
      const r = data.report;
      setPendingImportFile(file);
      setImportMsg(
        `Validation: ${r.validRows}/${r.totalRows} valid. Issues: ${r.issues.length}. ${
          r.issues.length
            ? r.issues
                .slice(0, 5)
                .map((i: { row: number; message: string }) => `Row ${i.row}: ${i.message}`)
                .join(' | ')
            : 'Ready to import — click Commit Import.'
        }`
      );
    } else {
      setImportMsg(`Imported ${data.created} row(s). Skipped ${data.skipped}.`);
      setPendingImportFile(null);
      load();
    }
  };

  const pages = Math.max(1, Math.ceil(total / pageSize));

  const parentDisplay = (row: Row) => {
    if (level === 'plants') return row.site?.name;
    if (level === 'areas') return row.plant?.name;
    if (level === 'units')
      return [row.plant?.name, row.area?.name].filter(Boolean).join(' / ') || row.plant?.name;
    if (level === 'systems') return row.unit?.name;
    if (level === 'assets')
      return row.system?.name || row.unit?.name || row.Site?.name || row.site?.name;
    return row.location || '—';
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{cfg.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{cfg.subtitle}</p>
          <p className="text-xs text-gray-400 mt-1">
            Platform → Tenant → Site → Plant → Area? → Unit → System → Asset
          </p>
        </div>
        <Can permission={cfg.managePermission}>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
          >
            + Add
          </button>
        </Can>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Search</label>
          <input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Code or name…"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </div>
        <Can permission={cfg.managePermission}>
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Import</label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="text-xs"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImport(f, true);
                e.target.value = '';
              }}
            />
            {pendingImportFile && (
              <button
                type="button"
                onClick={() => onImport(pendingImportFile, false)}
                className="mt-1 block text-xs font-semibold text-indigo-600 hover:underline"
              >
                Commit Import
              </button>
            )}
          </div>
        </Can>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {importMsg && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {importMsg}
        </div>
      )}

      {showForm && canManage && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            {editingId ? 'Edit' : 'Create'} {cfg.title.replace(/s$/, '')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cfg.parentField && (
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  {cfg.parentLabel} *
                </label>
                <select
                  value={form.parent_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, parent_id: e.target.value, area_id: '' }))
                  }
                  disabled={!!editingId}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Select…</option>
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {level === 'units' && (
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Area (optional)
                </label>
                <select
                  value={form.area_id}
                  onChange={(e) => setForm((f) => ({ ...f, area_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  disabled={!form.parent_id}
                >
                  <option value="">None — hang under Plant</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                {cfg.codeLabel || 'Code'}
              </label>
              <input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Description
              </label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            {level === 'sites' && (
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Location
                </label>
                <input
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-600">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={
                saving ||
                !form.name.trim() ||
                (!!cfg.parentField && !editingId && !form.parent_id)
              }
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-sm text-gray-400">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-16 text-center text-sm text-gray-500">No records found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Code</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">
                  {level === 'sites' ? 'Location' : 'Parent'}
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">
                    {row.tag_number || row.code || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-900">{row.name}</td>
                  <td className="px-4 py-3 text-gray-500">{parentDisplay(row) || '—'}</td>
                  <td className="px-4 py-3">{statusBadge(row)}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Can permission={cfg.managePermission}>
                      {!row.deleted_at && (
                        <button
                          onClick={() => startEdit(row)}
                          className="text-indigo-600 hover:underline text-xs font-medium"
                        >
                          Edit
                        </button>
                      )}
                      {row.deleted_at ? (
                        <button
                          onClick={() => restore(row.id)}
                          className="text-emerald-600 hover:underline text-xs font-medium"
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          onClick={() => archive(row.id)}
                          className="text-red-600 hover:underline text-xs font-medium"
                        >
                          Archive
                        </button>
                      )}
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {total > pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
            <span>
              {total} total · page {page} / {pages}
            </span>
            <div className="space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-2 py-1 border rounded disabled:opacity-40"
              >
                Prev
              </button>
              <button
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2 py-1 border rounded disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
