'use client';

import { useMemo, useState } from 'react';
import { WorkpackListTable } from './WorkpackListTable';
import type { WorkpackListItemDTO } from './WorkpackDashboard';

interface WorkpackListWithBulkExportProps {
  workpacks: WorkpackListItemDTO[];
  userRole?: string;
}

export function WorkpackListWithBulkExport({ workpacks, userRole }: WorkpackListWithBulkExportProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const allSelected = workpacks.length > 0 && selected.size === workpacks.length;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(workpacks.map((w) => w.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedIds = useMemo(() => [...selected], [selected]);

  async function exportCombined(format: 'csv' | 'excel' | 'msproject_xml') {
    if (selectedIds.length === 0) return;
    setExporting(true);
    try {
      const res = await fetch('/api/export/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workpackIds: selectedIds, format }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const ext = format === 'excel' ? 'xlsx' : format === 'msproject_xml' ? 'xml' : 'csv';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workpack-activities-${selectedIds.length}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  async function exportZipBundle() {
    if (selectedIds.length === 0) return;
    setExporting(true);
    try {
      const res = await fetch('/api/export/bundle-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workpackIds: selectedIds }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `ZIP export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workpack-activities-bundle.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'ZIP export failed');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-100 rounded-lg">
          <span className="text-sm font-medium text-blue-900">
            {selected.size} workpack{selected.size !== 1 ? 's' : ''} selected
          </span>
          <button
            type="button"
            disabled={exporting}
            onClick={() => exportCombined('csv')}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
          >
            Combined CSV
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => exportCombined('excel')}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
          >
            Combined Excel
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => exportZipBundle()}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
          >
            ZIP (one CSV each)
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-blue-600 hover:underline"
          >
            Clear selection
          </button>
        </div>
      )}

      <WorkpackListTable workpacks={workpacks} userRole={userRole} selected={selected} onToggle={toggleOne}>
        <tr>
          <th className="px-4 py-3 w-10">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              aria-label="Select all workpacks"
            />
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Site</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discipline</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Activities</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-12" />
        </tr>
      </WorkpackListTable>
    </div>
  );
}
