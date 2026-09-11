'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActiveShutdown, type ShutdownSummary } from '@/context/ActiveShutdownContext';

function getStatusColor(status: string) {
  const s = (status || '').toLowerCase();
  if (['active', 'in_progress', 'execution'].includes(s)) {
    return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' };
  }
  if (['planning', 'draft'].includes(s)) {
    return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' };
  }
  if (['completed', 'closed'].includes(s)) {
    return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', dot: 'bg-gray-400' };
  }
  return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' };
}

export function ShutdownListClient({ initialEvents }: { initialEvents: any[] }) {
  const router = useRouter();
  const { activeEventId, setActiveShutdown } = useActiveShutdown();
  const [filter, setFilter] = useState<'all' | 'active' | 'planning' | 'completed'>('all');

  const filteredEvents = initialEvents.filter((ev) => {
    if (filter === 'all') return true;
    const s = (ev.status || '').toLowerCase();
    if (filter === 'active') return ['active', 'in_progress', 'execution'].includes(s);
    if (filter === 'planning') return ['planning', 'draft'].includes(s);
    if (filter === 'completed') return ['completed', 'closed'].includes(s);
    return true;
  });

  const handleOpenWorkspace = (eventId: string) => {
    setActiveShutdown(eventId);
    router.push(`/events/${eventId}`);
  };

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
        {(['all', 'active', 'planning', 'completed'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              filter === f
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Grid of Shutdown Cards */}
      {filteredEvents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 text-xl">
            📅
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">No shutdowns found</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
            Get started by creating your first shutdown campaign to begin planning activities, schedules, and workpacks.
          </p>
          <Link
            href="/events/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm"
          >
            + Create Shutdown
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((ev) => {
            const isCurrentActive = ev.id === activeEventId;
            const colors = getStatusColor(ev.status);

            return (
              <div
                key={ev.id}
                className={`bg-white rounded-2xl border transition-all duration-200 p-6 flex flex-col justify-between ${
                  isCurrentActive
                    ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className="text-xs font-mono font-bold text-blue-600 block">{ev.code}</span>
                      <h3 className="text-lg font-black text-gray-900 tracking-tight leading-tight mt-0.5">
                        {ev.name}
                      </h3>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${colors.bg} ${colors.text} ${colors.border}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                      {ev.status}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 line-clamp-2 mb-4">
                    {ev.description || ev.scope_notes || 'No description provided.'}
                  </p>

                  <div className="grid grid-cols-3 gap-2 bg-gray-50/80 rounded-xl p-3 mb-4 text-center">
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-gray-400">Workpacks</span>
                      <span className="text-sm font-bold text-gray-800">{ev._count?.Workpack ?? 0}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-gray-400">WBS Nodes</span>
                      <span className="text-sm font-bold text-gray-800">{ev._count?.wbsNodes ?? 0}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-gray-400">Milestones</span>
                      <span className="text-sm font-bold text-gray-800">{ev._count?.milestones ?? 0}</span>
                    </div>
                  </div>

                  {ev.planned_start && (
                    <div className="text-xs text-gray-500 flex items-center gap-1.5 mb-4">
                      <span>🗓️</span>
                      <span>
                        {new Date(ev.planned_start).toLocaleDateString()}{' '}
                        {ev.planned_end ? `→ ${new Date(ev.planned_end).toLocaleDateString()}` : ''}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                  {isCurrentActive ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                      <span>✓</span> Active Workspace
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveShutdown(ev.id)}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Set as Active
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleOpenWorkspace(ev.id)}
                    className="inline-flex items-center gap-1 px-4 py-1.5 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-colors ml-auto"
                  >
                    Open Hub →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
