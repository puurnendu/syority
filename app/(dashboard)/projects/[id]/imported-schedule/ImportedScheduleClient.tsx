'use client';

import { useState, useMemo, useEffect, use } from 'react';
import useSWR from 'swr';
import { format } from 'date-fns';
import { useSession } from 'next-auth/react';

const fetcher = (url: string) => fetch(url).then(r => r.json());

// ── Virtual Scroll Constants ─────────────────────────────────────────
const ROW_HEIGHT = 34;
const HEADER_HEIGHT = 36;
const OVERSCAN = 25;

const COLUMNS = [
  { key: 'activity_number', label: 'ID',           width: 100 },
  { key: 'description',     label: 'Activity Name', width: 350 },
  { key: 'status',          label: 'Status',        width: 120 },
  { key: 'planned_start',   label: 'Start',         width: 130 },
  { key: 'planned_end',     label: 'Finish',        width: 130 },
  { key: 'duration_hours',  label: 'Duration (h)',  width: 100 },
  { key: 'progress_percent',label: 'Progress',      width: 100 },
  { key: 'wbs_code',        label: 'WBS',           width: 150 },
  { key: 'import_batch',    label: 'Import Batch',  width: 200 },
] as const;

export default function ImportedScheduleClient({ projectId }: { projectId: string }) {
  const { data: session } = useSession();
  const { data, error, isLoading, mutate } = useSWR(`/api/projects/${projectId}/imported-schedule`, fetcher);

  // Identify user type
  const isContractorTenant = (session?.user as any)?.tenant_type === 'contractor';
  const hasAffiliation = !!(session?.user as any)?.contractor_affiliation;
  const isIntegratedContractor = !isContractorTenant && hasAffiliation;
  const canManageImports = !isIntegratedContractor; // Standalone or Refinery Admin

  const [search, setSearch] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const [showImport, setShowImport] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Measure container height
  useEffect(() => {
    const handleResize = () => setContainerHeight(window.innerHeight - 300);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activities = data?.activities || [];
  const batches = data?.batches || [];

  const filtered = useMemo(() => {
    if (!search.trim()) return activities;
    const q = search.toLowerCase();
    return activities.filter((a: any) => 
      (a.description || '').toLowerCase().includes(q) ||
      (a.activity_number || '').toLowerCase().includes(q) ||
      (a.wbs_code || '').toLowerCase().includes(q)
    );
  }, [activities, search]);

  const totalHeight = filtered.length * ROW_HEIGHT;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIdx = Math.min(filtered.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN);
  const visibleRows = filtered.slice(startIdx, endIdx);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>, formatId: string, endpoint: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(formatId);
    setImportNotice(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/projects/${projectId}/import/${endpoint}`, {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'Import failed');

      setImportNotice({ type: 'success', msg: `Successfully imported ${result.imported} activities.` });
      mutate(); // Refresh data
    } catch (err: any) {
      setImportNotice({ type: 'error', msg: err.message });
    } finally {
      setUploading(null);
    }
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (!confirm('Are you sure you want to delete this import? All associated activities will be permanently removed.')) return;
    
    try {
      const res = await fetch(`/api/projects/${projectId}/imported-schedule?batchId=${batchId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      mutate();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (error) return <div className="p-8 text-red-500">Failed to load imported schedule.</div>;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header section */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="p-1 px-2 text-[10px] bg-blue-600 text-white rounded font-bold tracking-widest uppercase">Imported</span>
            Baseline Schedule
          </h1>
          <p className="text-xs text-gray-500 mt-1">Activities imported from MS Project or Primavera P6 XER/XML</p>
        </div>

        <div className="flex items-center gap-2">
          {canManageImports && (
            <button
              onClick={() => setShowImport(!showImport)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {showImport ? 'Close Panel' : 'Import New Schedule'}
            </button>
          )}
        </div>
      </div>

      {/* History & Import panel */}
      {showImport && canManageImports && (
        <div className="p-6 bg-gray-50 border-b border-gray-200 animate-in slide-in-from-top-4 duration-300">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Import UI */}
              <div>
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Import Actions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'ms-project', label: 'MS Project (XML)', endpoint: 'ms-project', ext: '.xml' },
                    { id: 'p6-xml', label: 'P6 (XML)', endpoint: 'p6-xml', ext: '.xml' },
                    { id: 'p6-xer', label: 'P6 (XER)', endpoint: 'p6-xer', ext: '.xer' },
                  ].map(f => (
                    <div key={f.id} className="relative group">
                      <input
                        type="file"
                        accept={f.ext}
                        onChange={(e) => handleImport(e, f.id, f.endpoint)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        disabled={!!uploading}
                      />
                      <div className={`p-4 border-2 border-dashed rounded-lg text-center transition-colors ${
                        uploading === f.id ? 'bg-blue-50 border-blue-400' : 'bg-white border-gray-200 group-hover:border-blue-400'
                      }`}>
                        <p className="text-xs font-bold text-gray-900 mb-1">{f.label}</p>
                        <p className="text-[10px] text-gray-400">{uploading === f.id ? 'Importing...' : 'Click to Upload'}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {importNotice && (
                  <div className={`mt-4 p-3 rounded-md border text-sm ${
                    importNotice.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                  }`}>
                    {importNotice.msg}
                  </div>
                )}
              </div>

              {/* History Table */}
              <div>
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Import History</h3>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium">
                      <tr>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Source</th>
                        <th className="px-3 py-2 text-right">Activities</th>
                        {canManageImports && <th className="px-3 py-2 text-center">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {batches.map((b: any) => (
                        <tr key={b.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-900">{format(new Date(b.created_at), 'dd MMM HH:mm')}</td>
                          <td className="px-3 py-2 uppercase font-bold text-[10px] text-gray-500">{b.format.replace('_', ' ')}</td>
                          <td className="px-3 py-2 text-right text-gray-900">{b.activity_count?.toLocaleString()}</td>
                          {canManageImports && (
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => handleDeleteBatch(b.id)}
                                className="text-red-500 hover:text-red-700 font-bold"
                                title="Delete this import"
                              >
                                Rollback
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {batches.length === 0 && (
                        <tr>
                          <td colSpan={canManageImports ? 4 : 3} className="px-3 py-6 text-center text-gray-400">No import history found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Table + Search */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="relative w-72">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ID, name, WBS..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-blue-500"
            />
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="text-xs text-gray-500">
            Showing <strong className="text-gray-900">{filtered.length.toLocaleString()}</strong> of <strong className="text-gray-900">{activities.length.toLocaleString()}</strong> rows
          </div>
        </div>

        <div 
          className="flex-1 overflow-auto bg-white custom-scrollbar"
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        >
          <div style={{ width: COLUMNS.reduce((sum, col) => sum + col.width, 100), minWidth: '100%' }}>
            {/* Header */}
            <div className="sticky top-0 z-20 flex bg-[#0d2137] text-white border-b border-white/10" style={{ height: HEADER_HEIGHT }}>
              <div className="w-10 flex-shrink-0" />
              {COLUMNS.map(col => (
                <div key={col.key} className="px-3 flex items-center font-bold text-[10px] uppercase tracking-wider border-r border-white/5" style={{ width: col.width }}>
                  {col.label}
                </div>
              ))}
            </div>

            {/* Virtual Body */}
            <div style={{ height: totalHeight, position: 'relative' }}>
              <div style={{ height: startIdx * ROW_HEIGHT }} />
              {visibleRows.map((row: any, i: number) => {
                const globalIdx = startIdx + i;
                return (
                  <div
                    key={row.id}
                    className={`flex border-b text-[12px] hover:bg-blue-50/50 transition-colors ${globalIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}`}
                    style={{ height: ROW_HEIGHT }}
                  >
                    <div className="w-10 flex-shrink-0 flex items-center justify-center text-[10px] text-gray-300 border-r border-gray-100 italic">
                      {globalIdx + 1}
                    </div>
                    {COLUMNS.map(col => (
                      <div key={col.key} className="px-3 flex items-center border-r border-gray-100 flex-shrink-0 overflow-hidden" style={{ width: col.width }}>
                        <span className="truncate">
                          {col.key === 'planned_start' || col.key === 'planned_end' 
                            ? (row[col.key] ? format(new Date(row[col.key]), 'dd MMM yy') : '—')
                            : col.key === 'import_batch'
                              ? (row.import_batch?.filename || '—')
                              : col.key === 'status'
                                ? (
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    row.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {row.status || 'not started'}
                                  </span>
                                )
                                : (row[col.key] ?? '—')}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            
            {filtered.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center py-32 text-gray-400">
                <svg className="w-12 h-12 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M4 6h16M4 12h16m-7 6h7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-sm">{search ? 'No activities match your search' : 'No imported activities yet'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
