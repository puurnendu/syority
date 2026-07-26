'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import AIAssistantPanel from '@/components/Dashboard/AIAssistantPanel';
import Link from 'next/link';

interface UnitProgress {
  unit: string;
  planned: number;
  actual: number;
}
interface Constraint {
  id: string;
  title?: string;
  description?: string;
  impact: string;
  status: string;
  owner?: string;
  dueDate?: string;
  due_date?: string;
}
interface PunchSummary {
  A_open: number;
  A_closed: number;
  B_open: number;
  B_closed: number;
  C_open: number;
  C_closed: number;
}
interface SafetyLog {
  lti: number;
  nearMiss: number;
  firstAid: number;
  ptwIssued: number;
  ptwClosed: number;
  toolboxTalks: number;
}

const impactColor = (impact: string) =>
  ({
    Critical: 'bg-red-100 text-red-700 border-red-200',
    High: 'bg-red-50 text-red-600 border-red-200',
    Medium: 'bg-amber-50 text-amber-700 border-amber-200',
    Low: 'bg-gray-100 text-gray-600 border-gray-200',
  })[impact] ?? 'bg-gray-100 text-gray-600 border-gray-200';

const spiTextColor = (spi: number) =>
  spi >= 1 ? 'text-green-600' : spi >= 0.92 ? 'text-amber-600' : 'text-red-600';

const spiBgColor = (spi: number) =>
  spi >= 1 ? 'bg-green-50 border-green-200' : spi >= 0.92 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-5 ${className}`}>
      {children}
    </div>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="text-gray-500 mb-1 font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}%</strong>
        </p>
      ))}
    </div>
  );
}

export default function TADashboardPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id as string;

  const [project, setProject] = useState<{ id: string; name: string; code: string; status?: string } | null>(null);
  const [scurveData, setScurveData] = useState<{ w: string; planned: number; actual: number }[]>([]);
  const [kpis, setKpis] = useState({ spi: 1, planned: 0, actual: 0 });
  const [unitProgress, setUnitProgress] = useState<UnitProgress[]>([]);
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [punchData, setPunchData] = useState<{ summary: PunchSummary; items: any[] } | null>(null);
  const [lookahead, setLookahead] = useState<any[]>([]);
  const [safetyLog, setSafetyLog] = useState<SafetyLog | null>(null);
  const [histogramData, setHistogramData] = useState<any[]>([]);
  const [histogramDisciplines, setHistogramDisciplines] = useState<string[]>([]);
  const [aiJobs, setAiJobs] = useState('');
  const [jobsLoading, setJobsLoading] = useState(false);
  const [report, setReport] = useState('');
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'lookahead' | 'constraints' | 'punch' | 'resources' | 'report'>('overview');

  useEffect(() => {
    if (!projectId) return;

    // Try project first, then event (same ID can be project or event)
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.error && d.id) {
          setProject(d);
          return null;
        }
        return fetch(`/api/events/${projectId}`).then((r2) => r2.json());
      })
      .then((d) => {
        // Events API returns { data: event }, not the event at top level
        const event = d?.data ?? d;
        if (event?.id) {
          setProject({
            id: event.id,
            name: event.name ?? event.title ?? 'Event',
            code: event.code ?? event.reference ?? event.id.slice(0, 8),
            status: event.status ?? '',
          });
        }
      })
      .catch(() => {});

    // Try /api/projects first, then /api/events if project returns nothing (same ID can be event)
    fetch(`/api/projects/${projectId}/s-curve`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.error && (d.series?.length ?? 0) > 0) {
          const series = (d.series ?? []) as { date: string; planned: number; actual: number }[];
          const step = Math.max(1, Math.floor(series.length / 13));
          const weekly = series.filter((_: any, i: number) => i % step === 0).map((s: any, i: number) => ({ w: `W${i + 1}`, planned: s.planned, actual: s.actual }));
          setScurveData(weekly);
          setKpis({ spi: d.spi ?? 1, planned: d.latestPlanned ?? 0, actual: d.latestActual ?? 0 });
          return null;
        }
        return fetch(`/api/events/${projectId}/s-curve`).then((r2) => r2.json());
      })
      .then((d) => {
        if (!d?.series) return;
        const series = (d.series ?? []) as { date: string; planned: number; actual: number }[];
        const step = Math.max(1, Math.floor(series.length / 13));
        const weekly = series.filter((_: any, i: number) => i % step === 0).map((s: any, i: number) => ({ w: `W${i + 1}`, planned: s.planned, actual: s.actual }));
        setScurveData(weekly);
        setKpis({ spi: d.spi ?? 1, planned: d.latestPlanned ?? 0, actual: d.latestActual ?? 0 });
      })
      .catch(() => {});

    fetch(`/api/projects/${projectId}/activities/unit-progress`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.units?.length) setUnitProgress(d.units);
        else return fetch(`/api/events/${projectId}/activities/unit-progress`).then((r2) => r2.json()).then((d2) => setUnitProgress(d2?.units ?? []));
      })
      .catch(() => {});

    fetch(`/api/projects/${projectId}/constraints`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.data)) setConstraints(d.data);
        else return fetch(`/api/events/${projectId}/constraints`).then((r2) => r2.json()).then((d2) => setConstraints(Array.isArray(d2?.data) ? d2.data : []));
      })
      .catch(() => {});

    fetch(`/api/projects/${projectId}/punch`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.summary != null) setPunchData({ summary: d.summary, items: d.items ?? [] });
        else return fetch(`/api/events/${projectId}/punch`).then((r2) => r2.json()).then((d2) => d2?.summary != null && setPunchData({ summary: d2.summary, items: d2.items ?? [] }));
      })
      .catch(() => {});

    fetch(`/api/projects/${projectId}/lookahead?days=1`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.activities) setLookahead(d.activities);
        else return fetch(`/api/events/${projectId}/lookahead?days=1`).then((r2) => r2.json()).then((d2) => setLookahead(d2?.activities ?? []));
      })
      .catch(() => {});

    fetch(`/api/projects/${projectId}/safety?latest=true`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.log != null) setSafetyLog(d.log);
        else return fetch(`/api/events/${projectId}/safety?latest=true`).then((r2) => r2.json()).then((d2) => d2?.log != null && setSafetyLog(d2.log));
      })
      .catch(() => {});

    fetch(`/api/projects/${projectId}/resource-histogram`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.histogram) {
          setHistogramData(d.histogram);
          setHistogramDisciplines(d.disciplines || []);
        }
      })
      .catch(() => {});
  }, [projectId]);

  const loadAiJobs = async () => {
    setJobsLoading(true);
    setAiJobs('');
    try {
      const res = await fetch(`/api/projects/${projectId}/ai-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:
            'List the top 5 critical jobs for the next 24 hours. For each: job ID/description, why it is critical, recommended crew size, key risk. Concise bullet format.',
          chatHistory: [],
        }),
      });
      if (!res.ok || !res.body) {
        setAiJobs('Failed to load recommendations.');
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              text += parsed.text;
              setAiJobs(text);
            }
          } catch {
            // ignore
          }
        }
      }
    } catch {
      setAiJobs('Failed to load recommendations.');
    }
    setJobsLoading(false);
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/reports/daily`, { method: 'POST' });
      const data = await res.json();
      setReport(data.report ?? '');
    } catch {
      setReport('');
    }
    setGenerating(false);
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Loading dashboard…
      </div>
    );
  }

  const openConstraints = constraints.filter((c) => (c.status ?? 'Open') === 'Open');
  const punchSummary = punchData?.summary;

  const TABS = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'lookahead' as const, label: `Lookahead (${lookahead.length})` },
    { id: 'constraints' as const, label: `Constraints (${openConstraints.length})` },
    { id: 'punch' as const, label: 'Punch List' },
    { id: 'resources' as const, label: 'Resources' },
    { id: 'report' as const, label: 'Daily Report' },
  ];

  const KPI_CARDS = [
    { label: 'Overall Progress', planned: `${kpis.planned.toFixed(1)}%`, actual: `${kpis.actual.toFixed(1)}%`, delta: kpis.actual - kpis.planned, icon: '📊', colorActual: kpis.actual >= kpis.planned ? 'text-green-600' : 'text-red-600', bg: 'bg-white' },
    { label: 'SPI', planned: '1.00', actual: kpis.spi.toFixed(2), delta: kpis.spi - 1, icon: '📈', colorActual: kpis.spi >= 1 ? 'text-green-600' : kpis.spi >= 0.92 ? 'text-amber-600' : 'text-red-600', bg: 'bg-white' },
    { label: 'Open Constraints', planned: '0', actual: String(openConstraints.length), delta: -openConstraints.length, icon: '🚧', colorActual: openConstraints.length === 0 ? 'text-green-600' : openConstraints.length > 5 ? 'text-red-600' : 'text-amber-600', bg: 'bg-white' },
    { label: 'Cat-A Punch Items', planned: '0', actual: String(punchSummary?.A_open ?? 0), delta: -(punchSummary?.A_open ?? 0), icon: '📋', colorActual: (punchSummary?.A_open ?? 0) === 0 ? 'text-green-600' : 'text-red-600', bg: 'bg-white' },
    { label: 'Activities Complete', planned: String(lookahead.length), actual: String(lookahead.filter((a: any) => a.status === 'Complete' || (a.progress_percent ?? 0) >= 100).length), delta: 0, icon: '✅', colorActual: 'text-indigo-600', bg: 'bg-white' },
    { label: 'Safety — LTI', planned: '0', actual: String(safetyLog?.lti ?? (safetyLog as any)?.lti_count ?? 0), delta: -(safetyLog?.lti ?? 0), icon: '🦺', colorActual: (safetyLog?.lti ?? 0) === 0 ? 'text-green-600' : 'text-red-600', bg: 'bg-white' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <Link href={`/projects/${projectId}`} className="hover:text-gray-600">
              {project.name}
            </Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">TA Dashboard</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{project.code} · Live Turnaround Status</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>
            Updated{' '}
            {new Date().toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-1 font-medium">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            Live
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {KPI_CARDS.map((k) => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium">{k.label}</span>
              <span className="text-base">{k.icon}</span>
            </div>
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Planned</p>
                <p className="text-lg font-bold text-gray-400">{k.planned}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Actual</p>
                <p className={`text-2xl font-bold ${k.colorActual}`}>{k.actual}</p>
              </div>
            </div>
            {k.delta !== 0 && (
              <div className={`mt-1.5 text-xs font-medium ${k.delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {k.delta > 0 ? '▲' : '▼'} {Math.abs(Number(k.delta)).toFixed(1)}
                {(k.label.includes('Progress') || k.label === 'SPI') ? (k.label === 'SPI' ? '' : '%') : ''}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="xl:col-span-2 bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">S-Curve — Planned vs Actual Progress</h3>
                <p className="text-xs text-gray-400 mt-0.5">Cumulative progress by week</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-blue-600">
                  <span className="w-4 h-0.5 bg-blue-500 inline-block rounded" /> Planned
                </span>
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <span className="w-4 h-0.5 bg-emerald-500 inline-block rounded" /> Actual
                </span>
                <span className={`font-semibold ${spiTextColor(kpis.spi)}`}>
                  SPI {kpis.spi.toFixed(2)} {kpis.spi >= 1 ? '✓' : '▼'}
                </span>
              </div>
            </div>
            {scurveData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl">
                <p className="text-3xl mb-2">📈</p>
                <p className="text-gray-400 text-sm font-medium">No schedule data yet</p>
                <p className="text-xs text-gray-300 mt-1">Set planned start and finish dates on activities to generate this chart</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={scurveData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gradPlanned" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="w" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="planned" stroke="#3b82f6" fill="url(#gradPlanned)" strokeWidth={2.5} name="Planned %" dot={false} connectNulls />
                  <Area type="monotone" dataKey="actual" stroke="#10b981" fill="url(#gradActual)" strokeWidth={2.5} name="Actual %" dot={false} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Unit-wise Progress</h3>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-200 rounded inline-block" /> Planned</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-indigo-500 rounded inline-block" /> Actual</span>
              </div>
            </div>
            {unitProgress.length === 0 ? (
              <div className="h-56 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl">
                <p className="text-gray-400 text-sm">No units linked to workpacks yet</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={unitProgress} barCategoryGap="30%" margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="unit" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="planned" fill="#bfdbfe" name="Planned %" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="actual" fill="#6366f1" name="Actual %" radius={[3, 3, 0, 0]} label={{ position: 'top', fill: '#6b7280', fontSize: 10, formatter: (v: unknown) => `${v}%` }} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-2 flex-wrap mt-3 pt-3 border-t border-gray-100">
                  {unitProgress.map((u: any) => {
                    const d = (u.actual ?? 0) - (u.planned ?? 0);
                    return (
                      <div key={u.unit} className="flex flex-col items-center">
                        <span className="text-xs font-medium text-gray-600">{u.unit}</span>
                        <span className={`text-xs font-bold ${d >= 0 ? 'text-green-600' : Math.abs(d) <= 5 ? 'text-amber-600' : 'text-red-600'}`}>
                          {d > 0 ? '+' : ''}{d.toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Safety KPIs</h3>
              <span className="text-xs text-gray-400">Plan: 0 incidents target</span>
            </div>
            {safetyLog ? (
              <div className="space-y-3">
                {[
                  { label: 'LTI (Lost Time Incidents)', planned: 0, actual: safetyLog.lti ?? 0, danger: true },
                  { label: 'Near Miss', planned: 0, actual: safetyLog.nearMiss ?? 0, danger: false },
                  { label: 'First Aid Cases', planned: 0, actual: safetyLog.firstAid ?? 0, danger: false },
                  { label: 'PTW Issued', planned: null as number | null, actual: safetyLog.ptwIssued ?? 0, danger: false },
                  { label: 'PTW Closed', planned: null as number | null, actual: safetyLog.ptwClosed ?? 0, danger: false },
                  { label: 'Toolbox Talks', planned: null as number | null, actual: safetyLog.toolboxTalks ?? 0, danger: false },
                  { label: 'Manpower On-site', planned: null as number | null, actual: (safetyLog as any).manpowerOnsite ?? (safetyLog as any).manpower_onsite ?? 0, danger: false },
                ].map((k) => (
                  <div key={k.label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-600">{k.label}</span>
                    <div className="flex items-center gap-4">
                      {k.planned !== null && (
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400">Plan</p>
                          <p className="text-sm font-semibold text-gray-400">{k.planned}</p>
                        </div>
                      )}
                      <div className="text-right min-w-[2rem]">
                        {k.planned !== null && <p className="text-[10px] text-gray-400">Actual</p>}
                        <p className={`text-sm font-bold ${k.danger && k.actual > 0 ? 'text-red-600' : k.actual === 0 ? 'text-green-600' : 'text-amber-600'}`}>{k.actual}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-56 border-2 border-dashed border-gray-200 rounded-xl">
                <p className="text-3xl mb-2">🦺</p>
                <p className="text-gray-400 text-sm">No safety log for today</p>
                <Link href={`/projects/${projectId}/safety`} className="mt-2 text-xs text-indigo-500 hover:text-indigo-700">+ Log today&apos;s data</Link>
              </div>
            )}
          </div>

          <div className="xl:col-span-2 bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">AI Critical Jobs</h3>
                <p className="text-xs text-gray-400 mt-0.5">Next 24-hour recommendations based on live project data</p>
              </div>
              <button onClick={loadAiJobs} disabled={jobsLoading} className="px-3 py-1.5 text-xs font-medium border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 disabled:opacity-50 flex items-center gap-1.5">
                {jobsLoading ? <><span className="animate-spin">⟳</span> Loading…</> : '✨ Refresh'}
              </button>
            </div>
            {aiJobs ? (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{aiJobs}</div>
            ) : (
              <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
                <p className="text-3xl mb-2">🤖</p>
                <p className="text-sm text-gray-500">Click Refresh to get AI-powered recommendations for today</p>
                <p className="text-xs text-gray-400 mt-1">Based on live activities, constraints and punch data</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'lookahead' && (
        <Card>
          <SectionHeader title="24-Hour Lookahead" sub="Activities planned to start or in progress today" />
          {lookahead.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
              <p className="text-4xl mb-2">📅</p>
              <p className="text-gray-500 text-sm">No activities scheduled for the next 24 hours</p>
              <p className="text-xs text-gray-400 mt-1">Set planned start dates on activities to populate this view</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Activity ID', 'Description', 'Workpack', 'Discipline', 'Planned Start', 'Planned Finish', 'Duration', 'Progress (Planned vs Actual)', 'Priority'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lookahead.map((act: any) => (
                    <tr key={act.id} className={act.is_critical ? 'border-l-2 border-l-red-500' : ''}>
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold text-indigo-600">{act.activity_id ?? act.activity_number ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-900 max-w-xs truncate">{act.description ?? act.name}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 truncate max-w-[120px]">{act.workpackTitle ?? '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{act.discipline?.name ?? act.discipline?.code ?? '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{act.planned_start ? new Date(act.planned_start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{act.planned_finish ? new Date(act.planned_finish).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{act.duration_hours ? `${act.duration_hours}h` : '—'}</td>
                      <td className="px-4 py-2.5 min-w-[160px]">
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                            <span>Plan: {act.planned_progress ?? act.progress_percent ?? 0}%</span>
                            <span>Actual: {act.progress_percent ?? 0}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 relative">
                            <div className="absolute h-2 rounded-full bg-blue-200" style={{ width: `${Math.min(act.planned_progress ?? act.progress_percent ?? 0, 100)}%` }} />
                            <div className={`absolute h-2 rounded-full ${(act.progress_percent ?? 0) >= (act.planned_progress ?? act.progress_percent ?? 0) ? 'bg-green-500' : 'bg-red-400'}`} style={{ width: `${Math.min(act.progress_percent ?? 0, 100)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {act.is_critical ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">🔴 Critical</span> : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Normal</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {activeTab === 'constraints' && (
        <Card>
          <SectionHeader title={`Open Constraints (${openConstraints.length})`} sub="Issues blocking progress — sorted by impact" />
          {openConstraints.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-green-200 rounded-xl bg-green-50">
              <p className="text-4xl mb-2">🎉</p>
              <p className="text-green-700 font-medium">No open constraints</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...openConstraints]
                .sort((a, b) => {
                  const order: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
                  return (order[a.impact] ?? 4) - (order[b.impact] ?? 4);
                })
                .map((c) => (
                  <div
                    key={c.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border ${
                      c.impact === 'Critical' || c.impact === 'High'
                        ? 'bg-red-50 border-red-200'
                        : c.impact === 'Medium'
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{c.title ?? c.description}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Owner: {c.owner ?? '—'} · Due: {c.dueDate ?? c.due_date ? new Date(c.dueDate ?? c.due_date!).toLocaleDateString('en-IN') : '—'}
                      </p>
                    </div>
                    <span className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border ${impactColor(c.impact)}`}>{c.impact}</span>
                  </div>
                ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'punch' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { cat: 'A', label: 'Must close before startup', open: punchSummary?.A_open ?? 0, closed: punchSummary?.A_closed ?? 0, color: 'red' as const },
              { cat: 'B', label: 'Can close after startup', open: punchSummary?.B_open ?? 0, closed: punchSummary?.B_closed ?? 0, color: 'amber' as const },
              { cat: 'C', label: 'Cosmetic / minor', open: punchSummary?.C_open ?? 0, closed: punchSummary?.C_closed ?? 0, color: 'gray' as const },
            ].map((cat) => {
              const total = cat.open + cat.closed;
              const pct = total > 0 ? Math.round((cat.closed / total) * 100) : 0;
              const colors = {
                red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', bar: 'bg-red-500' },
                amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', bar: 'bg-amber-500' },
                gray: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', bar: 'bg-gray-400' },
              }[cat.color];
              return (
                <Card key={cat.cat}>
                  <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${colors.bg} ${colors.text} border ${colors.border} mb-3`}>{cat.cat}</div>
                  <p className="text-xs text-gray-400 mb-2">{cat.label}</p>
                  <div className="flex items-end justify-between mt-2">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase">Planned</p>
                      <p className="text-xl font-bold text-gray-300">0</p>
                      <p className="text-xs text-gray-400">open</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 uppercase">Actual</p>
                      <p className={`text-3xl font-bold ${cat.open > 0 ? colors.text : 'text-green-600'}`}>{cat.open}</p>
                      <p className="text-xs text-gray-400">open · {cat.closed} closed</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-3"><div className={`h-2 rounded-full ${colors.bar}`} style={{ width: `${pct}%` }} /></div>
                  <p className="text-xs text-gray-400 mt-1 text-right">{pct}% closed</p>
                </Card>
              );
            })}
          </div>
          <Card>
            <SectionHeader title="Punch Items" sub={`${punchData?.items?.length ?? 0} total items`} />
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['#', 'Cat', 'Description', 'Discipline', 'Location', 'Assigned To', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(punchData?.items ?? []).slice(0, 50).map((item: any, i: number) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">{item.punch_number ?? item.punchNumber ?? i + 1}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                            item.category === 'A' ? 'bg-red-100 text-red-700' : item.category === 'B' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          Cat {item.category}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-900 max-w-xs truncate">{item.description}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{item.discipline ?? '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{item.location ?? '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{item.assigned_to ?? item.assignedTo ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-medium ${item.status === 'Closed' ? 'text-green-600' : 'text-amber-600'}`}>{item.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'resources' && (
        <Card>
          <SectionHeader title="Resource Histogram" sub="Scheduled manpower load (hours) by discipline" />
          {histogramData.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
              <p className="text-4xl mb-2">👥</p>
              <p className="text-gray-500 text-sm">No scheduled resources</p>
              <p className="text-xs text-gray-400 mt-1">Set planned start dates and durations on activities</p>
            </div>
          ) : (
            <div className="w-full mt-4">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={histogramData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                    cursor={{ fill: '#f9fafb' }}
                  />
                  {histogramDisciplines.map((disc, idx) => {
                    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
                    return (
                      <Bar key={disc} dataKey={disc} stackId="a" fill={colors[idx % colors.length]} name={disc} />
                    );
                  })}
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap items-center justify-center gap-4 mt-6 border-t border-gray-100 pt-4">
                {histogramDisciplines.map((disc, idx) => {
                  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
                  return (
                    <div key={disc} className="flex items-center gap-1.5 text-xs text-gray-600">
                      <span className="w-3 h-3 rounded bg-current" style={{ color: colors[idx % colors.length] }} />
                      {disc}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      {activeTab === 'report' && (
        <Card>
          <div className="flex items-center justify-between mb-6">
            <SectionHeader title="AI Daily Progress Report" sub="Generated from live activity updates, constraints and punch items" />
            <button
              onClick={generateReport}
              disabled={generating}
              className="flex-shrink-0 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {generating ? (
                <>
                  <span className="animate-spin">⟳</span> Generating…
                </>
              ) : (
                '✨ Generate Report'
              )}
            </button>
          </div>
          {!report && !generating && (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
              <p className="text-4xl mb-3">📄</p>
              <p className="text-gray-500 font-medium">No report generated yet</p>
              <p className="text-xs text-gray-400 mt-1">Click &quot;Generate Report&quot; to create today&apos;s AI-assisted summary</p>
            </div>
          )}
          {generating && (
            <div className="text-center py-16">
              <p className="text-3xl animate-pulse mb-3">✨</p>
              <p className="text-gray-500 text-sm">AI is analysing today&apos;s project data…</p>
            </div>
          )}
          {report && !generating && (
            <>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-mono">
                {report}
              </div>
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={() => navigator.clipboard.writeText(report)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:border-gray-400 text-gray-600 flex items-center gap-1.5"
                >
                  📋 Copy
                </button>
                <button onClick={generateReport} className="px-3 py-1.5 text-sm text-indigo-500 hover:text-indigo-700">
                  ↺ Regenerate
                </button>
                <span className="ml-auto text-xs text-gray-400">AI-generated — review before distributing</span>
              </div>
            </>
          )}
        </Card>
      )}

      <AIAssistantPanel projectId={projectId} />
    </div>
  );
}
