'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const FREQ_BADGES: Record<string, { bg: string; text: string }> = {
  manual: { bg: '#F3F4F6', text: '#6B7280' },
  hourly: { bg: '#DBEAFE', text: '#2563EB' },
  daily: { bg: '#D1FAE5', text: '#059669' },
  weekly: { bg: '#E0E7FF', text: '#4F46E5' },
  monthly: { bg: '#FDE68A', text: '#92400E' },
  event_triggered: { bg: '#FCE7F3', text: '#BE185D' },
};

export function ScheduleManager() {
  const { data, error, isLoading, mutate } = useSWR('/api/report-builder/schedules', fetcher);
  const [triggering, setTriggering] = useState<string | null>(null);

  const handleTrigger = async (id: string) => {
    setTriggering(id);
    try {
      await fetch(`/api/report-builder/schedules/${id}/trigger`, { method: 'POST' });
      mutate();
    } finally {
      setTriggering(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this schedule?')) return;
    await fetch(`/api/report-builder/schedules/${id}`, { method: 'DELETE' });
    mutate();
  };

  const handleToggle = async (id: string, active: boolean) => {
    await fetch(`/api/report-builder/schedules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !active }),
    });
    mutate();
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#E8701A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const schedules = data?.schedules ?? [];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/report-builder" className="text-gray-400 hover:text-gray-600">←</Link>
          <div>
            <h1 className="text-xl font-bold text-[#0D2137]">Scheduled Reports</h1>
            <p className="text-sm text-gray-500 mt-1">{schedules.length} schedules configured</p>
          </div>
        </div>
      </div>

      {/* Schedule List */}
      <div className="flex-1 overflow-y-auto p-6">
        {schedules.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-4">⏰</div>
            <p className="text-lg font-medium">No scheduled reports</p>
            <p className="text-sm mt-1">Go to the Report Library and configure a report to schedule it</p>
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map((s: any) => {
              const freq = FREQ_BADGES[s.frequency] ?? FREQ_BADGES.manual;
              return (
                <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-[#0D2137]">{s.name}</h3>
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: freq.bg, color: freq.text }}
                        >
                          {s.frequency.replace(/_/g, ' ')}
                        </span>
                        {!s.is_active && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Paused</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {s.definition?.category?.icon} {s.definition?.name} · {s.output_format?.toUpperCase()} · {s.recipients?.length ?? 0} recipients
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        {s.delivery_time && <span>🕐 {s.delivery_time}</span>}
                        {s.last_run_at && <span>Last: {new Date(s.last_run_at).toLocaleString()}</span>}
                        {s.next_run_at && <span>Next: {new Date(s.next_run_at).toLocaleString()}</span>}
                        <span>Runs: {s.run_count}</span>
                      </div>
                      {s.last_error && (
                        <p className="text-xs text-red-500 mt-1">⚠️ {s.last_error}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleToggle(s.id, s.is_active)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          s.is_active
                            ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                            : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}
                      >
                        {s.is_active ? '⏸ Pause' : '▶️ Resume'}
                      </button>
                      <button
                        onClick={() => handleTrigger(s.id)}
                        disabled={triggering === s.id}
                        className="px-3 py-1.5 text-xs font-medium bg-[#E8701A] text-white rounded-lg hover:bg-[#d4631a] disabled:opacity-50 transition-colors"
                      >
                        {triggering === s.id ? '⏳...' : '▶ Run Now'}
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
