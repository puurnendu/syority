'use client';

import { useState } from 'react';

const PHASES: { title: string; days: string; items: { label: string; status: 'done' | 'partial' | 'todo' }[] }[] = [
  {
    title: 'Phase 1 — Foundation',
    days: 'Day 1-2',
    items: [
      { label: 'Project setup: Next.js 15 + TypeScript + Tailwind + Prisma', status: 'done' },
      { label: 'All SQL migrations run in order', status: 'done' },
      { label: 'prisma/schema.prisma updated and generated', status: 'done' },
      { label: 'NextAuth with User + Organization', status: 'done' },
      { label: 'Sidebar layout with all module links', status: 'done' },
      { label: 'Login/Register pages', status: 'done' },
    ],
  },
  {
    title: 'Phase 2 — Project & Equipment',
    days: 'Day 3-4',
    items: [
      { label: 'Projects CRUD (list + create + detail)', status: 'done' },
      { label: 'Units + Equipment CRUD', status: 'done' },
      { label: 'Equipment Types admin page', status: 'done' },
    ],
  },
  {
    title: 'Phase 3 — Workpack Engine',
    days: 'Day 5-7',
    items: [
      { label: 'Workpacks list + create', status: 'done' },
      { label: 'Workpack detail (tabbed: Overview | Activities | Materials | Blinds | Joints | Attachments)', status: 'done' },
      { label: 'Document upload', status: 'done' },
      { label: 'AI technical data extraction + verify/confirm/edit pattern', status: 'done' },
      { label: 'AI workpack generation (activities + materials)', status: 'done' },
      { label: 'Materials tab: discipline segregation + checkboxes + inline edit', status: 'done' },
      { label: 'Blind register + Joint register tabs', status: 'done' },
      { label: 'Attachments tab with grouped templates', status: 'done' },
    ],
  },
  {
    title: 'Phase 4 — Scheduling Engine',
    days: 'Day 8-10',
    items: [
      { label: 'Activity table with Gantt view', status: 'done' },
      { label: 'Predecessor/successor relationships UI', status: 'done' },
      { label: 'CPM calculation endpoint', status: 'done' },
      { label: 'S-Curve chart', status: 'done' },
      { label: 'Window (PreSD/OP/IR/CP/TO/SP/PostSD) field on activities', status: 'done' },
      { label: 'Lookahead page (24hr / 7 day / 14 day)', status: 'done' },
      { label: 'Critical path highlighting', status: 'done' },
    ],
  },
  {
    title: 'Phase 5 — PDF Generation',
    days: 'Day 11-12',
    items: [
      { label: 'Workpack PDF with all sections', status: 'done' },
      { label: 'Org admin column visibility settings', status: 'done' },
      { label: 'Attachment groups in PDF with mini-indexes', status: 'done' },
      { label: 'Materials Section J: mini-index + discipline pages', status: 'done' },
    ],
  },
  {
    title: 'Phase 6 — Field Tools',
    days: 'Day 13-14',
    items: [
      { label: 'Permits module', status: 'done' },
      { label: 'Safety log', status: 'done' },
      { label: 'Punch list (A/B/C)', status: 'done' },
      { label: 'Constraints tracker', status: 'done' },
      { label: 'Daily progress logging', status: 'done' },
    ],
  },
  {
    title: 'Phase 7 — Dashboard & Reports',
    days: 'Day 15-16',
    items: [
      { label: 'Executive dashboard', status: 'done' },
      { label: 'Unit-wise progress charts', status: 'done' },
      { label: 'SPI/CPI trend line', status: 'done' },
      { label: 'Constraint heatmap', status: 'done' },
      { label: 'Daily report generator (AI-assisted)', status: 'done' },
    ],
  },
  {
    title: 'Phase 8 — AI Assistant',
    days: 'Day 17',
    items: [
      { label: 'Context-aware chat panel', status: 'done' },
      { label: 'Project data injected into system prompt', status: 'done' },
      { label: 'Streaming response support', status: 'done' },
    ],
  },
  {
    title: 'Phase 9 — Notifications & Polish',
    days: 'Day 18',
    items: [
      { label: 'In-app notifications', status: 'done' },
      { label: 'Workpack approval workflow UI', status: 'done' },
      { label: 'Role-based access enforcement via CASL', status: 'done' },
      { label: 'Mobile-responsive layout', status: 'done' },
    ],
  },
];

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

export function ImplementationRoadmap() {
  const [expanded, setExpanded] = useState<Record<number, boolean>>(() =>
    PHASES.reduce((acc, _, i) => ({ ...acc, [i]: i < 3 }), {} as Record<number, boolean>)
  );
  const [showAll, setShowAll] = useState(false);

  const toggle = (i: number) =>
    setExpanded((prev) => ({ ...prev, [i]: !prev[i] }));

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Implementation Roadmap</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Reporting &amp; management system — phase checklist
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
        >
          {showAll ? 'Collapse all' : 'Expand all'}
        </button>
      </div>
      <div className="divide-y divide-gray-100">
        {PHASES.map((phase, phaseIndex) => {
          const isOpen = showAll || expanded[phaseIndex];
          const completedCount = phase.items.filter(it => it.status === 'done').length;

          return (
            <div key={phaseIndex} className="bg-gray-50/50 first:bg-transparent">
              <button
                type="button"
                onClick={() => (showAll ? undefined : toggle(phaseIndex))}
                className="w-full px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-gray-50/80 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {!showAll && (
                    <span className="flex-shrink-0 text-gray-400">
                      <ChevronDown open={isOpen} />
                    </span>
                  )}
                  <span className="font-semibold text-gray-900">{phase.title}</span>
                  <span className="text-xs text-gray-500 font-normal">({phase.days})</span>
                </div>
                <span className="text-xs text-gray-500 flex-shrink-0 font-medium">
                  {completedCount}/{phase.items.length} done
                </span>
              </button>
              {(showAll || isOpen) && (
                <ul className="px-5 pb-4 pt-0 space-y-1 list-none">
                  {phase.items.map((item, itemIndex) => (
                    <li
                      key={itemIndex}
                      className={`flex items-start gap-2.5 text-sm pl-7 ${item.status === 'todo' ? 'text-gray-400' : 'text-gray-700'}`}
                    >
                      <span
                        className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded border inline-flex items-center justify-center text-[10px] ${
                          item.status === 'done'
                            ? 'bg-green-500 border-green-500 text-white'
                            : item.status === 'partial'
                              ? 'bg-amber-100 border-amber-300 text-amber-600'
                              : 'bg-white border-gray-300 text-gray-300'
                        }`}
                        aria-hidden
                      >
                        {item.status === 'done' ? '✓' : item.status === 'partial' ? '!' : '□'}
                      </span>
                      <span className={item.status === 'done' ? 'font-medium' : ''}>{item.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
