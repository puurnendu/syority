/**
 * M7.6A — Data Fetcher Registry
 *
 * Maps query keys (e.g. "planning.lookahead_24h") to server-side Prisma queries.
 * Each fetcher accepts (orgId, parameters) and returns structured data
 * suitable for rendering into report sections.
 *
 * M7.6B NOTE: This file is preserved for backward compatibility.
 * New code should use the ProviderRegistry from '@/core/report-engine/providers'.
 * The dataFetcherRegistry below still works and delegates to the same Prisma queries.
 * Future providers will only be registered via the ProviderRegistry.
 */

import { prisma } from '@/lib/prisma';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DataFetcherResult {
  rows?: any[];
  tables?: Record<string, { rows: any[]; columns?: Array<{ key: string; label: string }> }>;
  kpis?: Array<{ label: string; value: string | number; unit?: string; trend?: 'up' | 'down' | 'flat'; color?: string }>;
  summary?: string;
  chartData?: any;
  metadata?: Record<string, any>;
}

export type DataFetcher = (orgId: string, params: Record<string, any>) => Promise<DataFetcherResult>;

// ─── Helpers ────────────────────────────────────────────────────────────────

function toDateFilter(params: Record<string, any>) {
  const filters: any = {};
  if (params.date_from) filters.gte = new Date(params.date_from);
  if (params.date_to) filters.lte = new Date(params.date_to);
  return Object.keys(filters).length ? filters : undefined;
}

function scopeFilters(params: Record<string, any>) {
  const where: any = {};
  if (params.site) where.site_id = params.site;
  if (params.unit) where.unit_id = params.unit;
  if (params.event) where.event_id = params.event;
  if (params.contractor) where.contractor_id = params.contractor;
  if (params.discipline) where.discipline_id = params.discipline;
  return where;
}

// ─── Planning Fetchers ──────────────────────────────────────────────────────

const planningLookahead24h: DataFetcher = async (orgId, params) => {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 3600_000);
  const activities = await prisma.activity.findMany({
    where: {
      organization_id: orgId, deleted_at: null,
      early_start: { gte: now, lte: in24h },
      actual_end: null,
      ...scopeFilters(params),
    },
    select: {
      activity_number: true, description: true, status: true, early_start: true,
      early_finish: true, is_critical: true, responsible: true,
      workpack: { select: { title: true, workpack_number: true } },
    },
    orderBy: { early_start: 'asc' },
  });
  return {
    rows: activities.map((a) => ({
      activity: a.activity_number, description: a.description, workpack: a.workpack?.workpack_number ?? '—',
      start: a.early_start?.toISOString().slice(0, 16).replace('T', ' ') ?? '—',
      finish: a.early_finish?.toISOString().slice(0, 16).replace('T', ' ') ?? '—',
      status: a.status, critical: a.is_critical ? '⚠️ Yes' : 'No', responsible: a.responsible ?? '—',
    })),
    kpis: [
      { label: 'Activities Next 24h', value: activities.length },
      { label: 'Critical', value: activities.filter((a) => a.is_critical).length, color: '#DC2626' },
    ],
  };
};

const planningLookahead72h: DataFetcher = async (orgId, params) => {
  const now = new Date();
  const in72h = new Date(now.getTime() + 72 * 3600_000);
  const activities = await prisma.activity.findMany({
    where: { organization_id: orgId, deleted_at: null, early_start: { gte: now, lte: in72h }, actual_end: null, ...scopeFilters(params) },
    select: { activity_number: true, description: true, status: true, early_start: true, early_finish: true, is_critical: true, responsible: true, workpack: { select: { title: true, workpack_number: true } } },
    orderBy: { early_start: 'asc' },
  });
  return {
    rows: activities.map((a) => ({
      activity: a.activity_number, description: a.description, workpack: a.workpack?.workpack_number ?? '—',
      start: a.early_start?.toISOString().slice(0, 16).replace('T', ' ') ?? '—',
      finish: a.early_finish?.toISOString().slice(0, 16).replace('T', ' ') ?? '—',
      status: a.status, critical: a.is_critical ? '⚠️ Yes' : 'No',
    })),
    kpis: [
      { label: 'Activities Next 72h', value: activities.length },
      { label: 'Critical', value: activities.filter((a) => a.is_critical).length, color: '#DC2626' },
    ],
  };
};

const planningConstraintRegister: DataFetcher = async (orgId, params) => {
  const constraints = await prisma.constraint.findMany({
    where: { organization_id: orgId, ...scopeFilters(params) },
    select: { id: true, description: true, type: true, status: true, severity: true, responsible: true, created_at: true, due_date: true },
    orderBy: { created_at: 'desc' },
  }).catch(() => []);
  return {
    rows: constraints.map((c: any) => ({
      description: c.description, type: c.type ?? '—', status: c.status, severity: c.severity ?? '—',
      responsible: c.responsible ?? '—', due: c.due_date?.toISOString().split('T')[0] ?? '—',
    })),
    kpis: [
      { label: 'Total Constraints', value: constraints.length },
      { label: 'Open', value: constraints.filter((c: any) => c.status === 'open').length, color: '#DC2626' },
    ],
  };
};

const planningCriticalPath: DataFetcher = async (orgId, params) => {
  const activities = await prisma.activity.findMany({
    where: { organization_id: orgId, deleted_at: null, is_critical: true, ...scopeFilters(params) },
    select: { activity_number: true, description: true, early_start: true, early_finish: true, total_float: true, status: true, workpack: { select: { workpack_number: true } } },
    orderBy: { early_start: 'asc' },
  });
  return {
    rows: activities.map((a) => ({
      activity: a.activity_number, description: a.description, workpack: a.workpack?.workpack_number ?? '—',
      start: a.early_start?.toISOString().split('T')[0] ?? '—', finish: a.early_finish?.toISOString().split('T')[0] ?? '—',
      float: a.total_float != null ? Number(a.total_float) : '—', status: a.status,
    })),
    kpis: [{ label: 'Critical Activities', value: activities.length, color: '#DC2626' }],
  };
};

const planningWorkpackReadiness: DataFetcher = async (orgId, params) => {
  const workpacks = await prisma.workpack.findMany({
    where: { organization_id: orgId, deleted_at: null, ...scopeFilters(params) },
    select: { workpack_number: true, title: true, status: true, overall_progress: true, priority: true, discipline: { select: { name: true } }, contractor: { select: { name: true } } },
    orderBy: { workpack_number: 'asc' },
    take: 200,
  });
  const instantiations = await prisma.workpackInstantiation.findMany({
    where: { organization_id: orgId, workpack_id: { in: workpacks.map((w) => w.workpack_number).filter(Boolean) as string[] } },
    select: { workpack_id: true, readiness_score: true, compliance_score: true },
  }).catch(() => []);
  const scoreMap = new Map(instantiations.map((i) => [i.workpack_id, i]));

  return {
    rows: workpacks.map((w) => ({
      workpack: w.workpack_number ?? '—', title: w.title, status: w.status,
      progress: `${w.overall_progress ?? 0}%`, priority: w.priority ?? 'Normal',
      discipline: w.discipline?.name ?? '—', contractor: w.contractor?.name ?? '—',
      readiness: scoreMap.get(w.workpack_number ?? '')?.readiness_score ?? '—',
    })),
    kpis: [
      { label: 'Total Workpacks', value: workpacks.length },
      { label: 'Draft', value: workpacks.filter((w) => w.status === 'draft').length },
      { label: 'In Progress', value: workpacks.filter((w) => w.status === 'in_progress').length, color: '#2563EB' },
    ],
  };
};

// ─── Shutdown Fetchers ──────────────────────────────────────────────────────

const shutdownScopeRegister: DataFetcher = async (orgId, params) => {
  const items = await prisma.scopeItem.findMany({
    where: { organization_id: orgId, scope: params.scope_id ? { id: params.scope_id } : undefined },
    select: { tag_number: true, asset_name: true, discipline: true, work_description: true, status: true, estimated_hours: true, priority: true },
    orderBy: { tag_number: 'asc' },
    take: 500,
  }).catch(() => []);
  return {
    rows: items.map((i: any) => ({
      tag: i.tag_number ?? '—', asset: i.asset_name ?? '—', discipline: i.discipline ?? '—',
      work: i.work_description ?? '—', status: i.status, hours: i.estimated_hours ?? 0, priority: i.priority ?? '—',
    })),
    kpis: [
      { label: 'Scope Items', value: items.length },
      { label: 'Est. Hours', value: items.reduce((s: number, i: any) => s + (i.estimated_hours ?? 0), 0) },
    ],
  };
};

const shutdownScopeChangeRegister: DataFetcher = async (orgId, params) => {
  const changes = await prisma.scopeChangeRequest.findMany({
    where: { organization_id: orgId, ...(params.scope_id ? { scope_id: params.scope_id } : {}) },
    select: { title: true, change_type: true, status: true, reason: true, estimated_hours: true, submitted_at: true, priority: true },
    orderBy: { submitted_at: 'desc' },
  }).catch(() => []);
  return {
    rows: changes.map((c: any) => ({
      title: c.title, type: c.change_type, status: c.status, reason: c.reason?.slice(0, 80) ?? '—',
      hours: c.estimated_hours ?? '—', submitted: c.submitted_at?.toISOString().split('T')[0] ?? '—',
    })),
    kpis: [
      { label: 'Change Requests', value: changes.length },
      { label: 'Pending', value: changes.filter((c: any) => c.status === 'pending').length, color: '#F59E0B' },
      { label: 'Approved', value: changes.filter((c: any) => c.status === 'approved').length, color: '#059669' },
    ],
  };
};

const shutdownDeferredScope: DataFetcher = async (orgId, params) => {
  const deferrals = await prisma.scopeDeferral.findMany({
    where: { organization_id: orgId },
    select: { reason: true, deferred_at: true, target_event: true, carried_forward: true, scope_item: { select: { tag_number: true, asset_name: true } } },
    orderBy: { deferred_at: 'desc' },
  }).catch(() => []);
  return {
    rows: deferrals.map((d: any) => ({
      tag: d.scope_item?.tag_number ?? '—', asset: d.scope_item?.asset_name ?? '—',
      reason: d.reason?.slice(0, 80) ?? '—', deferred: d.deferred_at?.toISOString().split('T')[0] ?? '—',
      target: d.target_event ?? '—', carried: d.carried_forward ? 'Yes' : 'No',
    })),
    kpis: [
      { label: 'Deferred Items', value: deferrals.length },
      { label: 'Carried Forward', value: deferrals.filter((d: any) => d.carried_forward).length },
    ],
  };
};

const shutdownWorkpackStatus: DataFetcher = async (orgId, params) => {
  const workpacks = await prisma.workpack.findMany({
    where: { organization_id: orgId, deleted_at: null, ...scopeFilters(params) },
    select: { workpack_number: true, title: true, status: true, overall_progress: true, planned_start_date: true, planned_end_date: true },
    orderBy: { status: 'asc' },
    take: 300,
  });
  const statusCounts: Record<string, number> = {};
  workpacks.forEach((w) => { statusCounts[w.status] = (statusCounts[w.status] ?? 0) + 1; });
  return {
    rows: workpacks.map((w) => ({
      workpack: w.workpack_number ?? '—', title: w.title, status: w.status, progress: `${w.overall_progress ?? 0}%`,
      start: w.planned_start_date?.toISOString().split('T')[0] ?? '—', end: w.planned_end_date?.toISOString().split('T')[0] ?? '—',
    })),
    kpis: Object.entries(statusCounts).map(([status, count]) => ({ label: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: count })),
  };
};

const shutdownUnitProgress: DataFetcher = async (orgId, params) => {
  const activities = await prisma.activity.findMany({
    where: { organization_id: orgId, deleted_at: null, ...scopeFilters(params) },
    select: { wbs_code: true, progress_percent: true, status: true },
  });
  const unitMap = new Map<string, { total: number; completed: number; count: number }>();
  activities.forEach((a) => {
    const unit = (a.wbs_code ?? 'Unassigned').split('.')[0];
    const cur = unitMap.get(unit) ?? { total: 0, completed: 0, count: 0 };
    cur.total += 100; cur.completed += (a.progress_percent ?? 0); cur.count++;
    unitMap.set(unit, cur);
  });
  return {
    rows: Array.from(unitMap.entries()).map(([unit, v]) => ({
      unit, activities: v.count, planned: '100%', actual: `${v.count > 0 ? Math.round(v.completed / v.count) : 0}%`,
    })),
  };
};

const shutdownContractorProgress: DataFetcher = async (orgId, params) => {
  const workpacks = await prisma.workpack.findMany({
    where: { organization_id: orgId, deleted_at: null, contractor_id: { not: null }, ...scopeFilters(params) },
    select: { overall_progress: true, status: true, contractor: { select: { name: true } } },
  });
  const map = new Map<string, { count: number; totalProgress: number }>();
  workpacks.forEach((w) => {
    const name = w.contractor?.name ?? 'Unknown';
    const cur = map.get(name) ?? { count: 0, totalProgress: 0 };
    cur.count++; cur.totalProgress += (w.overall_progress ?? 0);
    map.set(name, cur);
  });
  return {
    rows: Array.from(map.entries()).map(([contractor, v]) => ({
      contractor, workpacks: v.count, avg_progress: `${v.count > 0 ? Math.round(v.totalProgress / v.count) : 0}%`,
    })),
  };
};

const shutdownDisciplineProgress: DataFetcher = async (orgId, params) => {
  const workpacks = await prisma.workpack.findMany({
    where: { organization_id: orgId, deleted_at: null, discipline_id: { not: null }, ...scopeFilters(params) },
    select: { overall_progress: true, status: true, discipline: { select: { name: true } } },
  });
  const map = new Map<string, { count: number; totalProgress: number }>();
  workpacks.forEach((w) => {
    const name = w.discipline?.name ?? 'Unknown';
    const cur = map.get(name) ?? { count: 0, totalProgress: 0 };
    cur.count++; cur.totalProgress += (w.overall_progress ?? 0);
    map.set(name, cur);
  });
  return {
    rows: Array.from(map.entries()).map(([discipline, v]) => ({
      discipline, workpacks: v.count, avg_progress: `${v.count > 0 ? Math.round(v.totalProgress / v.count) : 0}%`,
    })),
  };
};

// ─── Execution Fetchers ─────────────────────────────────────────────────────

const executionShiftProgress: DataFetcher = async (orgId, params) => {
  const now = new Date();
  const shiftStart = new Date(now);
  shiftStart.setHours(shiftStart.getHours() - 12);
  const logs = await prisma.progressLog.findMany({
    where: { organization_id: orgId, created_at: { gte: shiftStart }, ...scopeFilters(params) },
    select: { activity: { select: { activity_number: true, description: true, workpack: { select: { workpack_number: true } } } }, old_progress: true, new_progress: true, created_at: true, created_by_user: { select: { name: true } } },
    orderBy: { created_at: 'desc' },
    take: 200,
  }).catch(() => []);
  return {
    rows: (logs as any[]).map((l) => ({
      activity: l.activity?.activity_number ?? '—', description: l.activity?.description ?? '—',
      workpack: l.activity?.workpack?.workpack_number ?? '—',
      from: `${l.old_progress ?? 0}%`, to: `${l.new_progress ?? 0}%`,
      by: l.created_by_user?.name ?? '—', time: l.created_at?.toISOString().slice(11, 16) ?? '—',
    })),
    kpis: [{ label: 'Progress Updates', value: logs.length }],
  };
};

const executionDailyProgress: DataFetcher = async (orgId, params) => {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const logs = await prisma.progressLog.findMany({
    where: { organization_id: orgId, created_at: { gte: todayStart }, ...scopeFilters(params) },
    select: { activity: { select: { activity_number: true, description: true } }, old_progress: true, new_progress: true, created_at: true },
    orderBy: { created_at: 'desc' },
    take: 300,
  }).catch(() => []);
  return {
    rows: (logs as any[]).map((l) => ({
      activity: l.activity?.activity_number ?? '—', description: l.activity?.description ?? '—',
      from: `${l.old_progress ?? 0}%`, to: `${l.new_progress ?? 0}%`,
      time: l.created_at?.toISOString().slice(11, 16) ?? '—',
    })),
    kpis: [{ label: "Today's Updates", value: logs.length }],
  };
};

const executionDelayRegister: DataFetcher = async (orgId, params) => {
  const activities = await prisma.activity.findMany({
    where: { organization_id: orgId, deleted_at: null, actual_end: null, late_finish: { lt: new Date() }, ...scopeFilters(params) },
    select: { activity_number: true, description: true, late_finish: true, early_finish: true, status: true, workpack: { select: { workpack_number: true } } },
    orderBy: { late_finish: 'asc' },
    take: 100,
  });
  return {
    rows: activities.map((a) => ({
      activity: a.activity_number, description: a.description, workpack: a.workpack?.workpack_number ?? '—',
      late_finish: a.late_finish?.toISOString().split('T')[0] ?? '—', status: a.status,
      days_late: a.late_finish ? Math.ceil((Date.now() - a.late_finish.getTime()) / 86400_000) : '—',
    })),
    kpis: [{ label: 'Delayed Activities', value: activities.length, color: '#DC2626' }],
  };
};

const executionQaPending: DataFetcher = async (orgId, params) => {
  const records = await prisma.qa_clearance_records.findMany({
    where: { organization_id: orgId, status: { in: ['pending', 'in_progress'] } },
    select: { check_type: true, status: true, activity: { select: { activity_number: true, description: true } }, assigned_to_user: { select: { name: true } } },
    orderBy: { created_at: 'desc' },
    take: 100,
  }).catch(() => []);
  return {
    rows: (records as any[]).map((r) => ({
      activity: r.activity?.activity_number ?? '—', description: r.activity?.description ?? '—',
      type: r.check_type ?? '—', status: r.status, assigned: r.assigned_to_user?.name ?? '—',
    })),
    kpis: [{ label: 'Pending QA Checks', value: records.length, color: '#F59E0B' }],
  };
};

const executionCertificateStatus: DataFetcher = async (orgId, _params) => {
  const certs = await prisma.certificate.findMany({
    where: { organization_id: orgId },
    select: { certificate_type: true, status: true, workpack: { select: { workpack_number: true } } },
    orderBy: { created_at: 'desc' },
    take: 200,
  }).catch(() => []);
  const statusCounts: Record<string, number> = {};
  (certs as any[]).forEach((c) => { statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1; });
  return {
    rows: (certs as any[]).map((c) => ({
      workpack: c.workpack?.workpack_number ?? '—', type: c.certificate_type ?? '—', status: c.status,
    })),
    kpis: Object.entries(statusCounts).map(([status, count]) => ({ label: status, value: count })),
  };
};

const executionPunchRegister: DataFetcher = async (orgId, params) => {
  const punches = await prisma.punchListItem.findMany({
    where: { organization_id: orgId, deleted_at: null, ...scopeFilters(params) },
    select: { punch_number: true, description: true, category: true, status: true, priority: true, assigned_to: true },
    orderBy: { created_at: 'desc' },
    take: 300,
  }).catch(() => []);
  const catCounts: Record<string, number> = {};
  (punches as any[]).forEach((p) => { catCounts[p.category ?? 'Other'] = (catCounts[p.category ?? 'Other'] ?? 0) + 1; });
  return {
    rows: (punches as any[]).map((p) => ({
      number: p.punch_number ?? '—', description: p.description ?? '—', category: p.category ?? '—',
      status: p.status, priority: p.priority ?? '—', assigned: p.assigned_to ?? '—',
    })),
    kpis: [
      { label: 'Total Punches', value: punches.length },
      ...Object.entries(catCounts).map(([cat, count]) => ({ label: `Cat ${cat}`, value: count })),
    ],
  };
};

// ─── Management Fetchers ────────────────────────────────────────────────────

const managementExecutiveDashboard: DataFetcher = async (orgId, params) => {
  const activities = await prisma.activity.findMany({
    where: { organization_id: orgId, deleted_at: null, ...scopeFilters(params) },
    select: { progress_percent: true, budgeted_cost: true, actual_cost: true, early_start: true, early_finish: true, actual_start: true },
  });
  const now = new Date();
  const BAC = activities.reduce((s, a) => s + Number(a.budgeted_cost ?? 0), 0) || 1;
  const ACWP = activities.reduce((s, a) => a.actual_start ? s + Number(a.actual_cost ?? 0) : s, 0);
  const BCWP = activities.reduce((s, a) => s + Number(a.budgeted_cost ?? 0) * (Number(a.progress_percent ?? 0) / 100), 0);
  const BCWS = activities.reduce((s, a) => {
    if (!a.early_finish) return s;
    const fin = new Date(a.early_finish);
    const start = a.early_start ? new Date(a.early_start) : now;
    const dur = fin.getTime() - start.getTime();
    if (dur <= 0) return s + Number(a.budgeted_cost ?? 0);
    const frac = Math.min(1, (now.getTime() - start.getTime()) / dur);
    return s + Number(a.budgeted_cost ?? 0) * Math.max(0, frac);
  }, 0);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const spi = BCWS > 0 ? r2(BCWP / BCWS) : 1;
  const cpi = ACWP > 0 ? r2(BCWP / ACWP) : 1;
  const eac = cpi > 0 ? r2(BAC / cpi) : BAC;
  return {
    kpis: [
      { label: 'SPI', value: spi, trend: spi >= 1 ? 'up' : 'down', color: spi >= 1 ? '#059669' : '#DC2626' },
      { label: 'CPI', value: cpi, trend: cpi >= 1 ? 'up' : 'down', color: cpi >= 1 ? '#059669' : '#DC2626' },
      { label: 'BAC', value: r2(BAC), unit: '$' },
      { label: 'EAC', value: r2(eac), unit: '$' },
      { label: 'SV', value: r2(BCWP - BCWS), unit: '$', color: (BCWP - BCWS) >= 0 ? '#059669' : '#DC2626' },
      { label: 'CV', value: r2(BCWP - ACWP), unit: '$', color: (BCWP - ACWP) >= 0 ? '#059669' : '#DC2626' },
    ],
    summary: `Project EVM: SPI=${spi}, CPI=${cpi}. BAC=$${r2(BAC)}, EAC=$${r2(eac)}. Schedule Variance=$${r2(BCWP - BCWS)}, Cost Variance=$${r2(BCWP - ACWP)}.`,
    rows: [{ metric: 'BAC', value: r2(BAC) }, { metric: 'BCWS', value: r2(BCWS) }, { metric: 'BCWP', value: r2(BCWP) }, { metric: 'ACWP', value: r2(ACWP) }, { metric: 'SPI', value: spi }, { metric: 'CPI', value: cpi }, { metric: 'EAC', value: r2(eac) }],
  };
};

const managementKpiDashboard: DataFetcher = async (orgId, params) => {
  const [wpCount, actCount, punchCount] = await Promise.all([
    prisma.workpack.count({ where: { organization_id: orgId, deleted_at: null, ...scopeFilters(params) } }),
    prisma.activity.count({ where: { organization_id: orgId, deleted_at: null } }),
    prisma.punchListItem.count({ where: { organization_id: orgId, deleted_at: null } }).catch(() => 0),
  ]);
  const completedWp = await prisma.workpack.count({ where: { organization_id: orgId, deleted_at: null, status: 'completed' } });
  const completedAct = await prisma.activity.count({ where: { organization_id: orgId, deleted_at: null, status: 'completed' } });
  return {
    kpis: [
      { label: 'Total Workpacks', value: wpCount },
      { label: 'Completed WP', value: completedWp, color: '#059669' },
      { label: 'WP Completion', value: wpCount > 0 ? `${Math.round(completedWp / wpCount * 100)}` : '0', unit: '%' },
      { label: 'Total Activities', value: actCount },
      { label: 'Completed Act.', value: completedAct, color: '#059669' },
      { label: 'Punch Items', value: punchCount, color: '#F59E0B' },
    ],
  };
};

const managementScurve: DataFetcher = async (orgId, _params) => {
  return { summary: 'S-Curve data available — renders as chart in report output.', kpis: [{ label: 'S-Curve', value: 'Chart', unit: '' }] };
};

const managementSpi: DataFetcher = async (orgId, params) => {
  const result = await managementExecutiveDashboard(orgId, params);
  const spiKpi = result.kpis?.find((k) => k.label === 'SPI');
  return { kpis: spiKpi ? [spiKpi] : [{ label: 'SPI', value: 1.0 }], summary: `Schedule Performance Index: ${spiKpi?.value ?? 1.0}` };
};

const managementCpi: DataFetcher = async (orgId, params) => {
  const result = await managementExecutiveDashboard(orgId, params);
  const cpiKpi = result.kpis?.find((k) => k.label === 'CPI');
  return { kpis: cpiKpi ? [cpiKpi] : [{ label: 'CPI', value: 1.0 }], summary: `Cost Performance Index: ${cpiKpi?.value ?? 1.0}` };
};

const managementCostSummary: DataFetcher = async (orgId, params) => {
  const result = await managementExecutiveDashboard(orgId, params);
  return { kpis: result.kpis?.filter((k) => ['BAC', 'EAC', 'CV'].includes(k.label)), rows: result.rows };
};

const managementResourceSummary: DataFetcher = async (orgId, _params) => {
  const resources = await prisma.activityResource.findMany({
    where: { activity: { organization_id: orgId, deleted_at: null } },
    select: { resource_name: true, resource_type: true, planned_hours: true, actual_hours: true },
  }).catch(() => []);
  const map = new Map<string, { planned: number; actual: number; count: number }>();
  (resources as any[]).forEach((r) => {
    const key = r.resource_type ?? 'Other';
    const cur = map.get(key) ?? { planned: 0, actual: 0, count: 0 };
    cur.planned += Number(r.planned_hours ?? 0); cur.actual += Number(r.actual_hours ?? 0); cur.count++;
    map.set(key, cur);
  });
  return {
    rows: Array.from(map.entries()).map(([type, v]) => ({ type, count: v.count, planned_hours: v.planned, actual_hours: v.actual, utilization: v.planned > 0 ? `${Math.round(v.actual / v.planned * 100)}%` : '—' })),
  };
};

// ─── Platform Fetchers ──────────────────────────────────────────────────────

const platformUserActivity: DataFetcher = async (orgId, params) => {
  const dateFilter = toDateFilter(params);
  const logs = await prisma.auditLog.findMany({
    where: { organization_id: orgId, ...(dateFilter ? { created_at: dateFilter } : {}) },
    select: { user_id: true, action: true, model_name: true, created_at: true },
    orderBy: { created_at: 'desc' },
    take: 500,
  }).catch(() => []);
  const userMap = new Map<string, number>();
  (logs as any[]).forEach((l) => { userMap.set(l.user_id ?? 'system', (userMap.get(l.user_id ?? 'system') ?? 0) + 1); });
  return {
    rows: Array.from(userMap.entries()).map(([userId, count]) => ({ user_id: userId, action_count: count })),
    kpis: [{ label: 'Total Actions', value: logs.length }, { label: 'Active Users', value: userMap.size }],
  };
};

const platformAuditLog: DataFetcher = async (orgId, params) => {
  const dateFilter = toDateFilter(params);
  const logs = await prisma.auditLog.findMany({
    where: { organization_id: orgId, ...(dateFilter ? { created_at: dateFilter } : {}) },
    select: { action: true, model_name: true, model_id: true, user: { select: { name: true } }, created_at: true },
    orderBy: { created_at: 'desc' },
    take: 200,
  }).catch(() => []);
  return {
    rows: (logs as any[]).map((l) => ({
      action: l.action, model: l.model_name ?? '—', model_id: l.model_id?.slice(0, 8) ?? '—',
      user: l.user?.name ?? 'System', time: l.created_at?.toISOString().slice(0, 19).replace('T', ' ') ?? '—',
    })),
    kpis: [{ label: 'Log Entries', value: logs.length }],
  };
};

const platformNotificationStatistics: DataFetcher = async (_orgId, params) => {
  const dateFilter = toDateFilter(params);
  const [total, sent, failed, pending] = await Promise.all([
    prisma.notification_delivery_logs.count({ where: dateFilter ? { sent_at: dateFilter } : {} }).catch(() => 0),
    prisma.notification_delivery_logs.count({ where: { status: 'sent', ...(dateFilter ? { sent_at: dateFilter } : {}) } }).catch(() => 0),
    prisma.notification_delivery_logs.count({ where: { status: 'failed', ...(dateFilter ? { sent_at: dateFilter } : {}) } }).catch(() => 0),
    prisma.notification_queue.count({ where: { status: 'pending' } }).catch(() => 0),
  ]);
  return {
    kpis: [
      { label: 'Total Sent', value: total },
      { label: 'Delivered', value: sent, color: '#059669' },
      { label: 'Failed', value: failed, color: '#DC2626' },
      { label: 'Pending', value: pending, color: '#F59E0B' },
    ],
  };
};

const platformLoginHistory: DataFetcher = async (orgId, params) => {
  const dateFilter = toDateFilter(params);
  const logs = await prisma.auditLog.findMany({
    where: { organization_id: orgId, action: 'LOGIN', ...(dateFilter ? { created_at: dateFilter } : {}) },
    select: { user: { select: { name: true, email: true } }, created_at: true },
    orderBy: { created_at: 'desc' },
    take: 200,
  }).catch(() => []);
  return {
    rows: (logs as any[]).map((l) => ({
      user: l.user?.name ?? '—', email: l.user?.email ?? '—',
      time: l.created_at?.toISOString().slice(0, 19).replace('T', ' ') ?? '—',
    })),
    kpis: [{ label: 'Login Events', value: logs.length }],
  };
};

// ─── Registry ───────────────────────────────────────────────────────────────

export const dataFetcherRegistry: Record<string, DataFetcher> = {
  // Planning
  'planning.lookahead_24h': planningLookahead24h,
  'planning.lookahead_72h': planningLookahead72h,
  'planning.constraint_register': planningConstraintRegister,
  'planning.critical_path_summary': planningCriticalPath,
  'planning.workpack_readiness': planningWorkpackReadiness,
  // Shutdown
  'shutdown.scope_register': shutdownScopeRegister,
  'shutdown.scope_change_register': shutdownScopeChangeRegister,
  'shutdown.deferred_scope': shutdownDeferredScope,
  'shutdown.workpack_status': shutdownWorkpackStatus,
  'shutdown.unit_progress': shutdownUnitProgress,
  'shutdown.contractor_progress': shutdownContractorProgress,
  'shutdown.discipline_progress': shutdownDisciplineProgress,
  // Execution
  'execution.shift_progress': executionShiftProgress,
  'execution.daily_progress': executionDailyProgress,
  'execution.delay_register': executionDelayRegister,
  'execution.qa_pending': executionQaPending,
  'execution.certificate_status': executionCertificateStatus,
  'execution.punch_register': executionPunchRegister,
  // Management
  'management.executive_dashboard': managementExecutiveDashboard,
  'management.kpi_dashboard': managementKpiDashboard,
  'management.scurve': managementScurve,
  'management.spi': managementSpi,
  'management.cpi': managementCpi,
  'management.cost_summary': managementCostSummary,
  'management.resource_summary': managementResourceSummary,
  // Platform
  'platform.user_activity': platformUserActivity,
  'platform.audit_log': platformAuditLog,
  'platform.notification_statistics': platformNotificationStatistics,
  'platform.login_history': platformLoginHistory,
};
