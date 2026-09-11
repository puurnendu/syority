'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useActiveShutdown } from '@/context/ActiveShutdownContext';

function getStatusBadge(status: string) {
  const s = (status || '').toLowerCase();
  if (['active', 'in_progress', 'execution'].includes(s)) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (['planning', 'draft'].includes(s)) {
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }
  if (['completed', 'closed'].includes(s)) {
    return 'bg-gray-100 text-gray-700 border-gray-200';
  }
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

export function ActiveShutdownSelector({ siteName = 'Site' }: { siteName?: string }) {
  const { activeEventId, activeShutdown, allShutdowns, isLoading, setActiveShutdown } = useActiveShutdown();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const displaySite = activeShutdown?.site?.name || siteName;

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-xs transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
        title="Change Active Shutdown"
        aria-label="Active Shutdown Selector"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="text-gray-500 font-medium hidden md:inline truncate max-w-[120px]">
          {displaySite}
        </span>
        <span className="text-gray-300 hidden md:inline">|</span>

        {isLoading ? (
          <span className="text-gray-400 font-medium animate-pulse">Loading...</span>
        ) : activeShutdown ? (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span className="font-bold text-gray-900">{activeShutdown.code}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${getStatusBadge(activeShutdown.status)}`}>
              {activeShutdown.status}
            </span>
          </div>
        ) : (
          <span className="text-amber-600 font-medium">Select Shutdown</span>
        )}

        <svg
          className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 mt-1.5 w-72 sm:w-80 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50 animate-in fade-in-50 zoom-in-95 duration-100">
          <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Active Shutdown
            </span>
            <span className="text-[10px] text-gray-400 font-medium">
              {allShutdowns.length} Total
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto py-1 divide-y divide-gray-50">
            {allShutdowns.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-xs text-gray-500 mb-2">No shutdowns configured for this site.</p>
                <Link
                  href="/events/new"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700"
                >
                  + Create First Shutdown
                </Link>
              </div>
            ) : (
              allShutdowns.map((shutdown) => {
                const isSelected = shutdown.id === activeEventId;
                return (
                  <button
                    key={shutdown.id}
                    type="button"
                    onClick={() => {
                      setActiveShutdown(shutdown.id);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-start gap-2.5 transition-colors ${
                      isSelected ? 'bg-blue-50/80 text-blue-900' : 'hover:bg-gray-50 text-gray-800'
                    }`}
                  >
                    <div className="mt-0.5">
                      {isSelected ? (
                        <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px]">
                          ✓
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold truncate">{shutdown.code}</span>
                        <span className={`px-1.5 py-0.2 text-[9px] font-semibold uppercase rounded border ${getStatusBadge(shutdown.status)}`}>
                          {shutdown.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 truncate">{shutdown.name}</p>
                      {shutdown.planned_start && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(shutdown.planned_start).toLocaleDateString()} {shutdown.planned_end ? `→ ${new Date(shutdown.planned_end).toLocaleDateString()}` : ''}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-gray-100 px-3 py-2 bg-gray-50/60 rounded-b-xl flex items-center justify-between text-xs">
            <Link
              href="/events/new"
              onClick={() => setOpen(false)}
              className="text-blue-600 font-semibold hover:underline flex items-center gap-1"
            >
              <span>+</span> New Shutdown
            </Link>
            <Link
              href="/events"
              onClick={() => setOpen(false)}
              className="text-gray-500 hover:text-gray-800"
            >
              All Shutdowns →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
