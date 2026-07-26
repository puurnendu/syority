'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AIAssistantPanel from '@/components/Dashboard/AIAssistantPanel';
import { SCurveChart } from '@/components/Dashboard/SCurveChart';

export function ProjectDetailClient({
  projectId,
}: {
  projectId: string;
}) {
  const [project, setProject] = useState<Record<string, unknown> | null>(
    null
  );
  const [kpis, setKpis] = useState({
    spi: 1,
    planned: 0,
    actual: 0,
  });

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then(setProject);
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/s-curve`)
      .then((r) => r.json())
      .then((d) =>
        setKpis({
          spi: d.spi ?? 1,
          planned: d.latestPlanned ?? 0,
          actual: d.latestActual ?? 0,
        })
      )
      .catch(() => {});
  }, [projectId]);

  if (!project) {
    return (
      <div className="p-6 text-gray-400">Loading project...</div>
    );
  }

  const counts = (project._count as Record<string, number>) ?? {};

  const STAT_CARDS = [
    {
      label: 'Workpacks',
      value: counts.workpacks ?? 0,
      icon: '📦',
      href: `/projects/${projectId}/workpacks`,
    },
    {
      label: 'Equipment',
      value: counts.equipment ?? 0,
      icon: '🔧',
      href: `/projects/${projectId}/equipment`,
    },
    {
      label: 'Constraints',
      value: counts.projectConstraints ?? 0,
      icon: '⚠️',
      href: `/projects/${projectId}/constraints`,
    },
    {
      label: 'Punch Items',
      value: counts.punchItems ?? 0,
      icon: '📋',
      href: `/projects/${projectId}/punch`,
    },
    {
      label: 'Permits',
      value: counts.permits ?? 0,
      icon: '🔏',
      href: `/projects/${projectId}/permits`,
    },
  ];

  const PROJECT_TABS = [
    { label: 'Overview', href: `/projects/${projectId}` },
    { label: 'TA Dashboard', href: `/projects/${projectId}/ta-dashboard` },
    { label: 'Schedule', href: `/projects/${projectId}/schedule` },
    { label: 'Lookahead', href: `/projects/${projectId}/lookahead` },
    { label: 'Workpacks', href: `/projects/${projectId}/workpacks` },
    { label: 'Equipment', href: `/projects/${projectId}/equipment` },
    { label: 'Constraints', href: `/projects/${projectId}/constraints` },
    { label: 'Punch List', href: `/projects/${projectId}/punch` },
    { label: 'Permits', href: `/projects/${projectId}/permits` },
    { label: 'Daily Reports', href: `/projects/${projectId}/reports` },
    { label: 'Safety', href: `/projects/${projectId}/safety` },
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

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          {
            label: 'SPI',
            value: kpis.spi.toFixed(2),
            sub: kpis.spi >= 1 ? 'Ahead of schedule' : 'Behind schedule',
            color:
              kpis.spi >= 1
                ? 'text-green-600'
                : kpis.spi >= 0.85
                  ? 'text-amber-600'
                  : 'text-red-600',
            bg:
              kpis.spi >= 1
                ? 'bg-green-50 border-green-200'
                : kpis.spi >= 0.85
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-red-50 border-red-200',
          },
          {
            label: 'Planned Progress',
            value: `${kpis.planned.toFixed(1)}%`,
            sub: 'As of today',
            color: 'text-blue-600',
            bg: 'bg-blue-50 border-blue-200',
          },
          {
            label: 'Actual Progress',
            value: `${kpis.actual.toFixed(1)}%`,
            sub: `${kpis.actual >= kpis.planned ? '▲' : '▼'} vs planned`,
            color:
              kpis.actual >= kpis.planned ? 'text-green-600' : 'text-red-600',
            bg: 'bg-gray-50 border-gray-200',
          },
        ].map((k) => (
          <div
            key={k.label}
            className={`border rounded-xl p-4 ${k.bg}`}
          >
            <p className="text-xs text-gray-500 mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <SCurveChart projectId={projectId} />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Project Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {([
            ['Client', project.client],
            ['Plant / Refinery', project.plantName],
            ['Location', project.location],
            [
              'Planned Shutdown',
              project.plannedSdDate
                ? new Date(String(project.plannedSdDate)).toLocaleDateString(
                    'en-IN'
                  )
                : null,
            ],
            [
              'Planned Startup',
              project.plannedSuDate
                ? new Date(String(project.plannedSuDate)).toLocaleDateString(
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
      <AIAssistantPanel projectId={projectId} />
    </div>
  );
}
