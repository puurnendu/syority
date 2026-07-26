'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ITEM_CATEGORIES } from '@/lib/materials/constants';

type ItemsTab = 'catalog' | 'lookup' | 'log';

export default function ItemCatalogPage() {
  const [activeTab, setActiveTab] = useState<ItemsTab>('catalog');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Item Catalog</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage materials, gaskets, bolts, and consumables. Import from SAP.
        </p>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { key: 'catalog' as const, label: '📦 Item Catalog' },
          { key: 'lookup' as const, label: '🔩 Gasket-Bolt Lookup' },
          { key: 'log' as const, label: '📥 Import History' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'catalog' && <ItemCatalogTab />}
      {activeTab === 'lookup' && <GasketLookupTab />}
      {activeTab === 'log' && <ImportLogTab />}
    </div>
  );
}

const CATEGORY_TABS = [
  ...ITEM_CATEGORIES,
  { value: 'blind', label: 'Blind', color: 'bg-slate-100 text-slate-700' },
  { value: '_drafts', label: '⏳ Drafts', color: 'bg-amber-100 text-amber-700' },
] as const;

function ItemCatalogTab() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const category = searchParams.get('category') ?? '';

  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [totalCount, setTotalCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadItems();
  }, [page, search, category, status]);

  useEffect(() => {
    fetch('/api/master-data/items/counts')
      .then((res) => res.json())
      .then((d) => {
        setCategoryCounts(d.counts ?? {});
        setStatusCounts(d.statusCounts ?? {});
        setTotalCount(d.total ?? 0);
      })
      .catch(() => {});
  }, []);

  function setCategory(value: string) {
    const path = '/settings/items' + (value ? '?category=' + encodeURIComponent(value) : '');
    router.push(path);
    setPage(1);
  }

  async function publishDraftItem(itemId: string) {
    const res = await fetch(`/api/master-data/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: true }),
    });
    if (res.ok) await loadItems();
  }

  async function rejectDraftItem(itemId: string) {
    if (!confirm('Delete this draft item?')) return;
    await fetch(`/api/master-data/items/${itemId}`, { method: 'DELETE' });
    await loadItems();
  }

  async function loadItems() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
        ...(search && { search }),
        ...(category && { category }),
        ...(status && { status }),
      });
      const res = await fetch(`/api/master-data/items?${params}`);
      const d = await res.json();
      setItems(d.items ?? []);
      setTotal(d.total ?? 0);
    } catch (e: any) {
      setError('Failed to load: ' + (e?.message ?? 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    setError(null);

    const form = new FormData();
    form.append('file', file);

    try {
      const res = await fetch('/api/master-data/items/import', {
        method: 'POST',
        body: form,
      });
      const d = await res.json();
      setImportResult(d);
      if (d.success) await loadItems();
      if (!res.ok) setError(d.error ?? 'Import failed');
    } catch (err: any) {
      setError('Import failed: ' + (err?.message ?? 'Unknown error'));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <span>⚠</span>
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      )}

      {importResult && (
        <div
          className={`p-4 rounded-xl border text-sm ${
            importResult.success
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          <strong>
            {importResult.success ? '✅ Import complete' : '❌ Import failed'}
          </strong>
          {importResult.success && (
            <span className="ml-2">
              {importResult.imported} new · {importResult.updated} updated ·{' '}
              {importResult.errors} errors
            </span>
          )}
          {importResult.error_details?.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs">
                Show errors ({importResult.error_details.length})
              </summary>
              <ul className="mt-1 text-xs space-y-0.5">
                {importResult.error_details.map((err: any, i: number) => (
                  <li key={i}>
                    Row {err.row}: {err.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <button
            type="button"
            onClick={() => setImportResult(null)}
            className="float-right text-xs"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          onClick={() => setCategory('')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
            !category
              ? 'bg-[#0D2137] text-white border-[#0D2137]'
              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
          }`}
        >
          All ({totalCount})
        </button>
        {CATEGORY_TABS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setCategory(c.value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
              category === c.value
                ? 'bg-[#0D2137] text-white border-[#0D2137]'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {c.label} ({(categoryCounts[c.value] ?? 0)})
          </button>
        ))}

        <div className="w-px h-6 bg-gray-200 mx-1 self-center" />

        <button
          type="button"
          onClick={() => {
            setStatus(status === 'MISSING_SAP' ? '' : 'MISSING_SAP');
            setPage(1);
          }}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors flex items-center gap-2 ${
            status === 'MISSING_SAP'
              ? 'bg-orange-600 text-white border-orange-600'
              : 'bg-white text-orange-700 border-orange-200 hover:bg-orange-50'
          }`}
        >
          <span>⚠️ Missing SAP</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${status === 'MISSING_SAP' ? 'bg-white/20' : 'bg-orange-100'}`}>
            {statusCounts['MISSING_SAP'] ?? 0}
          </span>
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search description, SAP#, item code..."
          className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">All categories</option>
          {ITEM_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
          <option value="blind">Blind</option>
          <option value="_drafts">⏳ Drafts</option>
        </select>
        <span className="text-sm text-gray-500">
          {total.toLocaleString()} items
        </span>

        <label
          className={`px-3 py-2 border border-gray-300 text-sm rounded-lg cursor-pointer hover:bg-gray-50 flex items-center gap-1.5 ${
            importing ? 'opacity-50' : ''
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImport}
            disabled={importing}
            className="hidden"
          />
          {importing ? '⏳ Importing...' : '📥 Import from SAP'}
        </label>

        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="px-3 py-2 bg-[#0D2137] text-white text-sm rounded-lg hover:bg-[#1a3a5c]"
        >
          + Add Item
        </button>
      </div>

      <div className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
        📋 <strong>SAP Export:</strong> Use transaction MM60 or a custom ABAP
        report to export material master. Required columns: MATNR, MAKTX, MEINS.
        Optional: MTART, MFRNR, MFRPN, WERKS, LGORT. Save as .xlsx before
        importing.
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                Item Code
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                Description
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-24">
                Category
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-20">
                SAP #
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-24">
                Sync Status
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-16">
                UOM
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-20">
                Size
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-16">
                Rating
              </th>
              <th className="w-10 px-2 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-gray-400 text-sm"
                >
                  Loading...
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <div className="text-2xl mb-2">📦</div>
                  <p className="text-sm text-gray-500">
                    No items yet. Import from SAP or add manually.
                  </p>
                </td>
              </tr>
            )}
            {items.map((item) => {
              const cat = ITEM_CATEGORIES.find(
                (c) => c.value === item.item_category
              );
              return (
                <tr key={item.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700">
                    {item.item_code}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="text-gray-900">{item.description}</div>
                    {item.specification && (
                      <div className="text-xs text-gray-400">
                        {item.specification}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {!item.is_active && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full mr-1">
                        Draft
                      </span>
                    )}
                    {cat && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.color}`}
                      >
                        {cat.label}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">
                    <div className="flex items-center gap-1 group">
                      <span>{item.sap_material_number ?? '—'}</span>
                      {item.status === 'MISSING_SAP' && (
                        <span className="text-[10px] bg-orange-100 text-orange-700 px-1 py-0.5 rounded ml-1 font-sans font-normal">GAP</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {item.sap_sync_status === 'SYNCED' ? (
                      <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full font-medium">Synced</span>
                    ) : item.sap_sync_status === 'PENDING' ? (
                      <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full font-medium">Pending</span>
                    ) : (
                      <span className="text-[10px] bg-gray-50 text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded-full font-medium">Not Created</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">
                    {item.unit_of_measure}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">
                    {item.pipe_size ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">
                    {item.pressure_rating ?? '—'}
                  </td>
                  <td className="px-2 py-2.5">
                    {!item.is_active && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => publishDraftItem(item.id)}
                          className="text-xs text-green-600 hover:underline"
                        >
                          ✓ Publish
                        </button>
                        <button
                          type="button"
                          onClick={() => rejectDraftItem(item.id)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          ✕ Reject
                        </button>
                      </div>
                    )}
                    {item.is_active && (
                      <button
                        type="button"
                        onClick={() => {}}
                        className="text-xs text-gray-400 hover:text-blue-600"
                      >
                        ✎
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {total > 50 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} of{' '}
            {total}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-40"
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page * 50 >= total}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function GasketLookupTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/master-data/gasket-lookup')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        if (!cancelled) setRows(Array.isArray(d) ? d : []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = rows.filter(
    (r) =>
      !filter ||
      r.pipe_size?.includes(filter) ||
      r.pressure_class?.includes(filter) ||
      r.flange_type?.includes(filter)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by size, pressure class..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        />
        <span className="text-sm text-gray-500">
          {filtered.length} combinations
        </span>
      </div>

      <div className="text-xs text-gray-400 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2">
        🔩 This table auto-suggests gaskets and bolts when you add a joint with
        size + rating. Seeded with ASME B16.5 standards. Link items to your SAP
        catalog to get SAP numbers in exports.
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                Size
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                Class
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                Type
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                Gasket
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                Bolt
              </th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">
                Bolt Count
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                Nut
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  Loading...
                </td>
              </tr>
            )}
            {filtered.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-2.5 font-medium text-gray-900">
                  {row.pipe_size}
                </td>
                <td className="px-4 py-2.5 text-gray-700">
                  {row.pressure_class}
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                    {row.flange_type}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-sm text-gray-700">
                  {row.gasket_item?.description ??
                    row.gasket_description ??
                    '—'}
                  {row.gasket_item && (
                    <span className="ml-1.5 text-xs text-green-600">
                      ✓ linked
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-sm text-gray-700">
                  {row.bolt_item?.description ??
                    row.bolt_description ??
                    '—'}
                </td>
                <td className="px-4 py-2.5 text-center font-semibold text-gray-900">
                  {row.bolt_count}
                </td>
                <td className="px-4 py-2.5 text-sm text-gray-700">
                  {row.nut_item?.description ??
                    row.nut_description ??
                    '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImportLogTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/master-data/items/import/log')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        if (!cancelled) setLogs(Array.isArray(d) ? d : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              {[
                'Date',
                'File',
                'Imported By',
                'New',
                'Updated',
                'Errors',
                'Status',
              ].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-3 text-xs font-medium text-gray-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  Loading...
                </td>
              </tr>
            )}
            {!loading && logs.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-gray-400"
                >
                  No imports yet
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-2.5 text-gray-600">
                  {new Date(log.created_at).toLocaleDateString('en-GB')}
                </td>
                <td className="px-4 py-2.5 text-gray-900">{log.filename}</td>
                <td className="px-4 py-2.5 text-gray-600">
                  {log.imported_by}
                </td>
                <td className="px-4 py-2.5 text-green-700 font-medium">
                  +{log.imported_count}
                </td>
                <td className="px-4 py-2.5 text-blue-700">
                  ~{log.updated_count}
                </td>
                <td className="px-4 py-2.5 text-red-600">
                  {log.error_count > 0 ? log.error_count : '—'}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      log.status === 'complete'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {log.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
