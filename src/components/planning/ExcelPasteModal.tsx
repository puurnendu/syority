'use client';

import React, { useState } from 'react';

export interface ParsedPasteRow {
  temp_id: string;
  activity_number?: string;
  description: string;
  wbs_code?: string;
  discipline_code?: string;
  discipline_id?: string;
  duration_hours?: number;
  planned_start?: string;
  planned_end?: string;
  responsible?: string;
  notes?: string;
  isValid: boolean;
  errors: string[];
}

interface ExcelPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (rows: ParsedPasteRow[]) => void;
  disciplines: { id: string; code: string; name: string }[];
}

export function ExcelPasteModal({ isOpen, onClose, onImport, disciplines }: ExcelPasteModalProps) {
  const [rawText, setRawText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedPasteRow[]>([]);
  const [hasParsed, setHasParsed] = useState(false);

  if (!isOpen) return null;

  const handleParse = () => {
    if (!rawText.trim()) {
      setParsedRows([]);
      setHasParsed(true);
      return;
    }

    const lines = rawText.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const results: ParsedPasteRow[] = [];

    lines.forEach((line, index) => {
      // Split by tab (Excel TSV) or comma if no tabs
      const cells = line.includes('\t') ? line.split('\t') : line.split(',');
      const trimmed = cells.map((c) => c.trim().replace(/^["']|["']$/g, ''));

      // If header row detected on line 0, skip it
      if (index === 0 && (trimmed[0]?.toLowerCase().includes('activity') || trimmed[1]?.toLowerCase().includes('name') || trimmed[1]?.toLowerCase().includes('desc'))) {
        return;
      }

      const errors: string[] = [];
      let activity_number = '';
      let description = '';
      let wbs_code = '';
      let disc_code = '';
      let duration_hours = 8;
      let planned_start = '';
      let planned_end = '';
      let responsible = '';
      let notes = '';

      // Standard column sequence: [Activity#, Description, WBS, Discipline, Duration, Start, Finish, Contractor, Notes]
      // Or 2-column minimal: [Activity#, Description] or [Description, Duration]
      if (trimmed.length === 1) {
        description = trimmed[0];
      } else if (trimmed.length >= 2) {
        if (trimmed[0].match(/^[A-Za-z0-9-_]+$/) && trimmed[1].length > 0) {
          activity_number = trimmed[0];
          description = trimmed[1];
          wbs_code = trimmed[2] || '';
          disc_code = trimmed[3] || '';
          duration_hours = trimmed[4] && !isNaN(Number(trimmed[4])) ? parseFloat(trimmed[4]) : 8;
          planned_start = trimmed[5] || '';
          planned_end = trimmed[6] || '';
          responsible = trimmed[7] || '';
          notes = trimmed[8] || '';
        } else {
          description = trimmed[0];
          duration_hours = trimmed[1] && !isNaN(Number(trimmed[1])) ? parseFloat(trimmed[1]) : 8;
          disc_code = trimmed[2] || '';
          wbs_code = trimmed[3] || '';
        }
      }

      if (!description) {
        errors.push('Description is required.');
      }

      // Match discipline code if present
      let matchedDiscId: string | undefined;
      if (disc_code) {
        const found = disciplines.find(
          (d) => d.code?.toLowerCase() === disc_code.toLowerCase() || d.name?.toLowerCase() === disc_code.toLowerCase()
        );
        if (found) {
          matchedDiscId = found.id;
        } else {
          errors.push(`Unknown discipline "${disc_code}".`);
        }
      }

      results.push({
        temp_id: `paste-${Date.now()}-${index}`,
        activity_number: activity_number || undefined,
        description,
        wbs_code: wbs_code || undefined,
        discipline_code: disc_code || undefined,
        discipline_id: matchedDiscId,
        duration_hours,
        planned_start: planned_start || undefined,
        planned_end: planned_end || undefined,
        responsible: responsible || undefined,
        notes: notes || undefined,
        isValid: errors.length === 0,
        errors,
      });
    });

    setParsedRows(results);
    setHasParsed(true);
  };

  const validRows = parsedRows.filter((r) => r.isValid);
  const invalidRows = parsedRows.filter((r) => !r.isValid);

  const handleCommit = () => {
    if (validRows.length > 0) {
      onImport(validRows);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-100">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-gray-900 tracking-tight">
              Paste Activities from Excel / TSV
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Copy rows directly from Excel or Google Sheets and paste below.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {!hasParsed ? (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                Paste Spreadsheet Data (Ctrl+V)
              </label>
              <textarea
                rows={10}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`Example columns:\nACT-001\tInspect Reactor R-101\t1.1\tMECH\t16\t2026-10-02\t2026-10-04\tABC Contractors\nACT-002\tReplace Impeller P-102\t1.2\tMECH\t8\t2026-10-03\t2026-10-04\tIn-House`}
                className="w-full font-mono text-xs p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
              <p className="text-[11px] text-gray-400 mt-2">
                Recommended column order: <code>Activity #</code>, <code>Description</code>, <code>WBS</code>, <code>Discipline</code>, <code>Duration (h)</code>, <code>Planned Start</code>, <code>Planned End</code>, <code>Contractor</code>.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl">
                <div className="flex items-center gap-4 text-xs font-bold">
                  <span className="text-gray-700">Total: {parsedRows.length}</span>
                  <span className="text-emerald-600">✓ {validRows.length} Valid</span>
                  {invalidRows.length > 0 && (
                    <span className="text-red-600">⚠ {invalidRows.length} Errors</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setHasParsed(false)}
                  className="text-xs text-blue-600 hover:underline font-semibold"
                >
                  ← Edit Pasted Text
                </button>
              </div>

              {/* Table Preview */}
              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50 font-bold text-gray-600 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Activity #</th>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-left">WBS</th>
                      <th className="px-3 py-2 text-left">Discipline</th>
                      <th className="px-3 py-2 text-left">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-mono">
                    {parsedRows.map((row, idx) => (
                      <tr key={row.temp_id} className={row.isValid ? 'hover:bg-gray-50' : 'bg-red-50/50'}>
                        <td className="px-3 py-2">
                          {row.isValid ? (
                            <span className="text-emerald-600 font-bold">✓</span>
                          ) : (
                            <span className="text-red-600 font-bold" title={row.errors.join(', ')}>
                              ⚠ {row.errors[0]}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-bold text-gray-800">{row.activity_number || '—'}</td>
                        <td className="px-3 py-2 text-gray-900 font-sans">{row.description}</td>
                        <td className="px-3 py-2 text-gray-600">{row.wbs_code || '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{row.discipline_code || '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{row.duration_hours ?? 8}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
          {!hasParsed ? (
            <button
              type="button"
              onClick={handleParse}
              disabled={!rawText.trim()}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              Parse & Preview →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCommit}
              disabled={validRows.length === 0}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              Import {validRows.length} Valid Activities
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
