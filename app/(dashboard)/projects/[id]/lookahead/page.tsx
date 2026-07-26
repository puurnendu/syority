'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const WINDOW_STYLE: Record<string, string> = {
  PreSD: 'bg-blue-100 text-blue-800 border-blue-300',
  OP: 'bg-green-100 text-green-800 border-green-300',
  IR: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  CP: 'bg-red-100 text-red-800 border-red-300',
  TO: 'bg-purple-100 text-purple-800 border-purple-300',
  SP: 'bg-gray-100 text-gray-700 border-gray-300',
  PostSD: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  Unassigned: 'bg-gray-50 text-gray-500 border-gray-200',
};

export default function LookaheadPage() {
  const params = useParams();
  const projectId = params?.id as string;
  const [data, setData] = useState<{
    activities?: any[];
    byWindow?: Record<string, any[]>;
    overdue?: any[];
    days?: number;
  } | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  const load = (d: number) => {
    setLoading(true);
    fetch(`/api/projects/${projectId}/lookahead?days=${d}`)
      .then((r) => r.json())
      .then((v) => {
        setData(v);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (projectId) load(days);
  }, [projectId, days]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lookahead Schedule</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Upcoming activities grouped by execution window
          </p>
        </div>
        <div className="flex gap-1">
          {[1, 7, 14, 28].map((d) => (
            <button
              key={d}
              onClick={() => {
                setDays(d);
                load(d);
              }}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                days === d
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-300 text-gray-600 hover:border-indigo-300'
              }`}
            >
              {d === 1 ? '24 hrs' : `${d}d`}
            </button>
          ))}
        </div>
      </div>

      {data?.overdue && data.overdue.length > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <span className="text-red-500">⚠</span>
          <p className="text-sm text-red-700 font-medium">
            {data.overdue.length} overdue activit
            {data.overdue.length === 1 ? 'y' : 'ies'} — past planned finish date
          </p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading lookahead…</div>
      ) : !data?.activities?.length ? (
        <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-4xl mb-3">📅</p>
          <p className="font-medium text-gray-600">
            No activities in the next {days} day{days !== 1 ? 's' : ''}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Add planned start dates to activities to populate this view
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(data.byWindow ?? {}).map(([window, acts]: [string, any]) => (
            <div
              key={window}
              className={`border rounded-xl overflow-hidden ${
                WINDOW_STYLE[window]?.split(' ').slice(2).join(' ') ?? 'border-gray-200'
              }`}
            >
              <div
                className={`px-4 py-2.5 flex items-center justify-between ${
                  WINDOW_STYLE[window]?.split(' ').slice(0, 2).join(' ') ?? 'bg-gray-50 text-gray-700'
                }`}
              >
                <span className="text-sm font-semibold">{window}</span>
                <span className="text-xs font-medium">
                  {acts.length} activit{acts.length !== 1 ? 'ies' : 'y'}
                </span>
              </div>
              <div className="bg-white divide-y divide-gray-100">
                {acts.map((act: any) => (
                  <div
                    key={act.id}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50"
                  >
                    <div className="w-28 flex-shrink-0">
                      <p className="text-xs font-mono font-semibold text-indigo-600">
                        {act.activity_id ?? act.activity_number ?? '—'}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {act.workpackNumber}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {act.name ?? act.description}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {act.workpackTitle}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-600">
                        {act.planned_start
                          ? new Date(act.planned_start).toLocaleDateString(
                              'en-IN',
                              { day: '2-digit', month: 'short' }
                            )
                          : act.early_start
                            ? new Date(act.early_start).toLocaleDateString(
                                'en-IN',
                                { day: '2-digit', month: 'short' }
                              )
                            : '—'}
                      </p>
                      <p
                        className={`text-xs font-medium mt-0.5 ${
                          act.status === 'In Progress' || act.status === 'in_progress'
                            ? 'text-blue-600'
                            : act.status === 'Complete' || act.status === 'completed'
                              ? 'text-green-600'
                              : 'text-gray-400'
                        }`}
                      >
                        {act.status ?? '—'}
                      </p>
                    </div>
                    <div className="w-16 flex-shrink-0">
                      <div className="bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-indigo-500 h-1.5 rounded-full"
                          style={{ width: `${act.progress_percent ?? 0}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 text-right mt-0.5">
                        {act.progress_percent ?? 0}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
