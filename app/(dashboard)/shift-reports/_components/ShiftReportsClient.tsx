'use client';

import { useState, useEffect, useCallback } from 'react';

type ShiftReport = {
  id: string;
  shift_type: string;
  shift_start: string;
  shift_end: string;
  report_text: string;
  report_summary: string | null;
  activities_completed: number;
  activities_overdue: number;
  activities_in_progress: number;
  delivery_status: string;
  sent_at: string | null;
  unit: { name: string; code: string | null } | null;
  created_at: string;
};

function StatusBadge({ status }: { status: string }) {
  const isSent = status === 'sent';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
        isSent
          ? 'bg-green-100 text-green-700'
          : 'bg-amber-100 text-amber-700'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isSent ? 'bg-green-500' : 'bg-amber-400'}`} />
      {isSent ? 'Sent' : 'Pending'}
    </span>
  );
}

function DetailModal({ report, onClose }: { report: ShiftReport; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-[#0D2137]">
              {report.unit?.name ?? 'Unknown Unit'} — {report.shift_type} Shift
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {new Date(report.shift_start).toLocaleString('en-GB')} — {new Date(report.shift_end).toLocaleString('en-GB')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Stats Row */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-black text-green-600">{report.activities_completed}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Completed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-red-500">{report.activities_overdue}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Overdue</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-blue-600">{report.activities_in_progress}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">In Progress</p>
          </div>
        </div>

        {/* Report Text */}
        <div className="px-6 py-5">
          {report.report_summary && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1.5">AI Summary</p>
              <p className="text-sm text-blue-900 leading-relaxed">{report.report_summary}</p>
            </div>
          )}
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Full Report</p>
          <div className="whitespace-pre-wrap text-sm text-gray-800 border border-gray-200 rounded-xl p-4 bg-gray-50 font-mono leading-relaxed">
            {report.report_text || 'No report text available.'}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ShiftReportsClient() {
  const [reports, setReports] = useState<ShiftReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ShiftReport | null>(null);
  const [unitFilter, setUnitFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/shift-reports');
      const d = res.ok ? await res.json() : { data: [] };
      setReports(d.data ?? []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = unitFilter
    ? reports.filter(
        (r) =>
          r.unit?.name?.toLowerCase().includes(unitFilter.toLowerCase()) ||
          r.unit?.code?.toLowerCase().includes(unitFilter.toLowerCase()),
      )
    : reports;

  return (
    <>
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-black text-[#0D2137]">Shift Reports</h1>
          <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wider font-semibold">
            Automated shift-level completion reports
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Filter by unit…"
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium w-48 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
          />
          <button
            onClick={load}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-lg transition-colors uppercase tracking-tight"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading && (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm gap-2">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
            Loading shift reports…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center text-3xl mb-4">📋</div>
            <h3 className="text-base font-black text-gray-700 mb-1">No shift reports generated yet</h3>
            <p className="text-sm text-gray-400 max-w-xs">
              Reports are created automatically at each shift handover. Check back after the next shift change.
            </p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 font-black uppercase tracking-widest border-b border-gray-100">
                <tr>
                  <th className="px-5 py-3.5">Shift Date</th>
                  <th className="px-5 py-3.5">Unit</th>
                  <th className="px-5 py-3.5 text-center">Type</th>
                  <th className="px-5 py-3.5 text-center text-green-600">Completed</th>
                  <th className="px-5 py-3.5 text-center text-red-500">Overdue</th>
                  <th className="px-5 py-3.5 text-center text-blue-600">In Progress</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-5 py-3.5 font-bold text-gray-900 whitespace-nowrap">
                      {new Date(r.shift_start).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-gray-900">{r.unit?.name ?? 'Unknown'}</div>
                      {r.unit?.code && (
                        <div className="text-[10px] text-gray-400 font-mono">{r.unit.code}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-black rounded uppercase tracking-tight">
                        {r.shift_type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center font-black text-green-600">{r.activities_completed}</td>
                    <td className="px-5 py-3.5 text-center font-black text-red-500">{r.activities_overdue}</td>
                    <td className="px-5 py-3.5 text-center font-black text-blue-600">{r.activities_in_progress}</td>
                    <td className="px-5 py-3.5 text-center">
                      <StatusBadge status={r.delivery_status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setSelected(r)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-black rounded-lg uppercase tracking-tight transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <DetailModal report={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
