'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function ProjectDetailClient({
  projectId,
}: {
  projectId: string;
}) {
  const [project, setProject] = useState<Record<string, unknown> | null>(
    null
  );

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then(setProject);
  }, [projectId]);

  if (!project) {
    return (
      <div className="p-6 text-gray-400">Loading project...</div>
    );
  }

  const counts = (project._count as Record<string, number>) ?? {};

  // ── OD9.2 §22 / §28 — PROJECT surfaces only ─────────────────────────────────
  // A user inside PROJECT must not feel they are inside an STO system. The following
  // STO-owned surfaces were removed from the Project workspace, each for a stated reason:
  //
  //   TA Dashboard  — "TA" is Turnaround: an STO campaign dashboard, and a duplicate of
  //                   /events/[eventId]/ta-dashboard.
  //   Workpacks     — Workpack is the STO work-package container owned by Event
  //                   (Event → Workpack → Activity). STO surface: /workpacks.
  //   Punch List    — STO execution punch. STO surface: /punch.
  //   Permits       — §22: Permit Management is STO-only. STO surface: /permits.
  //   Safety        — §22: Safety is STO-only. STO surface: /safety.
  //   Daily Reports — STO daily/shift reporting. STO surface: /shift-reports.
  //
  // None of that STO functionality is deleted; it remains under the STO domain.
  // Retained as genuine Project functionality: Overview, Schedule, Lookahead (P6-class
  // planning), Constraints (`project_constraints` — a Project-domain table distinct from
  // the STO `Constraint` model) and Equipment.
  const STAT_CARDS = [
    {
      label: 'WBS nodes',
      value: counts.wbsNodes ?? 0,
      icon: '🌳',
      href: `/projects/${projectId}/wbs`,
    },
    {
      label: 'Work packages',
      value: counts.Workpack ?? 0,
      icon: '📦',
      href: `/projects/${projectId}/schedule`,
    },
  ];

  const PROJECT_TABS = [
    { label: 'Overview', href: `/projects/${projectId}` },
    { label: 'Schedule', href: `/projects/${projectId}/schedule` },
    { label: 'WBS', href: `/projects/${projectId}/wbs` },
    { label: 'Lookahead', href: `/projects/${projectId}/lookahead` },
    { label: 'Baselines', href: `/projects/${projectId}/baselines` },
    { label: 'Reports', href: `/projects/${projectId}/reports/status` },
    { label: 'Communications', href: `/projects/${projectId}/communications` },
    { label: 'Constraints', href: `/projects/${projectId}/constraints` },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
          <Link href="/projects" className="hover:text-gray-600">
            Projects
          </Link>
          <span>/</span>
          <span className="text-gray-700">{String(project.name)}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {String(project.name)}
            </h1>
            <p className="text-sm text-gray-400 font-mono mt-0.5">
              {String(project.code)}
            </p>
          </div>
          <span className="text-sm font-medium px-3 py-1 bg-green-100 text-green-800 rounded-full">
            {String(project.status)}
          </span>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {PROJECT_TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="px-4 py-2 text-sm text-gray-600 hover:text-indigo-600 whitespace-nowrap border-b-2 border-transparent hover:border-indigo-500 transition-colors"
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {STAT_CARDS.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all text-center"
          >
            <p className="text-2xl mb-1">{card.icon}</p>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
          </Link>
        ))}
      </div>

      {/* Phase 0 item 5: the SPI / Planned / Actual KPI cards, the Project
          SCurveChart and the AIAssistantPanel were removed from this overview.
          They were fed by the retired legacy Project S-curve endpoint and the
          quarantined legacy ai-assistant route, so they rendered an empty
          chart and misleading default KPIs (SPI 1.00). Project schedule and
          performance truth lives on the Schedule, Baselines and Reports tabs. */}

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Project Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {/* OD9.2 §15/§28: field names match what /api/projects/[id] returns
              (snake_case), and the labels are general project terms rather than
              shutdown terms. Both were previously wrong, so these rows never rendered. */}
          {([
            ['Client', project.client],
            ['Site', project.plant_name],
            ['Location', project.location],
            [
              'Planned Start',
              project.planned_sd_date
                ? new Date(String(project.planned_sd_date)).toLocaleDateString(
                    'en-IN'
                  )
                : null,
            ],
            [
              'Planned Finish',
              project.planned_su_date
                ? new Date(String(project.planned_su_date)).toLocaleDateString(
                    'en-IN'
                  )
                : null,
            ],
            ['Description', project.description],
          ] as [string, string | null | undefined][]).map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="font-medium text-gray-900">{value ?? '—'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
