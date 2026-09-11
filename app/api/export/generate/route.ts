import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { guardApi, orgScope } from '@/lib/apiGuard';

const today = () => new Date().toISOString().split('T')[0];
const esc = (s: unknown) => String(s ?? '').replace(/"/g, '""');
const escXml = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Safe field access for activity/workpack (schema may use snake_case or camelCase)
function actId(act: any): string {
  return act?.activity_id ?? act?.activityId ?? act?.activity_number ?? act?.code ?? act?.id?.slice(0, 8) ?? '';
}
function actDuration(act: any): number {
  return Number(act?.duration_hours ?? act?.durationHours ?? act?.duration ?? 8);
}
function actStart(act: any): Date | null {
  const v = act?.planned_start ?? act?.plannedStart ?? act?.start_date ?? null;
  return v ? new Date(v) : null;
}
function actEnd(act: any): Date | null {
  const v = act?.planned_end ?? act?.plannedEnd ?? act?.planned_finish ?? act?.plannedFinish ?? act?.end_date ?? null;
  return v ? new Date(v) : null;
}
function actProgress(act: any): number {
  return Number(act?.progress_percent ?? act?.progressPercent ?? act?.progress ?? 0);
}
function actName(act: any): string {
  return String(act?.description ?? act?.name ?? '');
}
function wpNum(wp: any): string {
  return wp?.workpack_number ?? wp?.workpackNumber ?? wp?.workpack_id_code ?? wp?.reference ?? wp?.code ?? wp?.id?.slice(0, 8) ?? '';
}

type UdfConfig = Record<string, boolean>;

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);

  /**
   * OD9.2 §6 — the export scope is declared EXPLICITLY per domain.
   *
   * `projectId` scopes to the PROJECT domain; `eventId` scopes to the STO domain.
   * They are never interchangeable. Previously a single `projectId` was looked up as a
   * Project and then, on miss, silently re-looked-up as an Event — an Event-as-Project
   * resolver, and the mirror image of the `resolveEventIdFromProject` pattern R0.4
   * forbade. §31 forbids fabricated Event mappings, so the caller must now say which
   * domain it means.
   */
  const body = (await req.json()) as {
    projectId?: string | null;
    eventId?: string | null;
    workpackIds: string[];
    format: 'csv' | 'excel' | 'msproject_xml' | 'p6_xer' | 'p6_xml';
    udfConfig: UdfConfig;
  };
  const projectId = body.projectId || null;
  const eventId = body.eventId || null;

  // Diagnostic: log actual Workpack and Activity field names
  try {
    const sample = await prisma.workpack.findFirst({
      include: { activities: { take: 1 } },
    });
    console.log('[Export] Workpack keys:', Object.keys(sample ?? {}));
    console.log('[Export] Activity keys:', Object.keys((sample as any)?.activities?.[0] ?? {}));
  } catch (e) {
    console.log('[Export] Diagnostic findFirst failed:', e);
  }

  try {
    // M8.5: Include predecessors and discipline for relationship export + activity codes
    const workpacks = await prisma.workpack.findMany({
      // OD9.2: `organization_id` added. This query was previously scoped only by the
      // caller-supplied ids, so possession of a Workpack UUID was sufficient to export
      // another tenant's schedule. UUID possession is not authorization.
      where: { id: { in: body.workpackIds }, organization_id: orgId },
      include: {
        activities: {
          include: {
            predecessors: {
              include: { predecessor: { select: { activity_number: true, id: true } } },
            },
            discipline: { select: { name: true, code: true } },
          },
        },
        asset: { select: { tag_number: true, name: true, description: true } },
        unit: {
          include: { plant: { select: { name: true } } },
        },
        contractor: { select: { name: true } },
      },
    });
    console.log('[Export] Loaded workpacks:', workpacks.length);
    console.log('[Export] Total activities:', workpacks.reduce((s, w) => s + (w.activities?.length ?? 0), 0));

  // Header/title metadata for the exported file. Resolved from whichever domain the
  // caller explicitly named — never by trying one domain and falling back to the other.
  // `Project` is tenant-scoped by the non-unique `org_id`, so this must be `findFirst`.
  let header: { name?: string; code?: string; plannedSdDate?: Date | null } | null = null;

  if (projectId) {
    const project = await prisma.project
      .findFirst({
        where: { id: projectId, org_id: orgId },
        select: { name: true, code: true, planned_sd_date: true },
      })
      .catch(() => null);
    if (project) {
      header = { name: project.name, code: project.code, plannedSdDate: project.planned_sd_date };
    }
  } else if (eventId) {
    const event = await prisma.event
      .findFirst({
        where: { id: eventId, organization_id: orgId },
        select: { name: true, code: true, planned_start: true },
      })
      .catch(() => null);
    if (event) {
      header = { name: event.name, code: event.code, plannedSdDate: event.planned_start };
    }
  }

  const project = header;

  const totalActivities = workpacks.reduce((s, w) => s + (w.activities?.length ?? 0), 0);
  const udf = { ...defaultUdf(), ...body.udfConfig };

  let content: string;
  let filename: string;
  let mimeType: string;

  if (body.format === 'csv' || body.format === 'excel') {
    const result = buildCSV(project, workpacks, udf);
    content = result.content;
    filename = `${project?.code ?? 'SYORITY'}_Schedule_${today()}.csv`;
    mimeType = 'text/csv';
  } else if (body.format === 'msproject_xml') {
    content = buildMSProjectXML(project, workpacks, udf);
    filename = `${project?.code ?? 'SYORITY'}_MSProject_${today()}.xml`;
    mimeType = 'application/xml';
  } else if (body.format === 'p6_xer') {
    content = buildP6XER(project, workpacks, udf);
    filename = `${project?.code ?? 'SYORITY'}_P6_${today()}.xer`;
    mimeType = 'text/plain';
  } else {
    content = buildP6XML(project, workpacks, udf);
    filename = `${project?.code ?? 'SYORITY'}_P6_${today()}.xml`;
    mimeType = 'application/xml';
  }

  try {
    await prisma.export_history.create({
      data: {
        // `export_history.id` has no database default, so it must be supplied. It was
        // previously omitted, which made every write throw into the catch below — the
        // audit trail has therefore never recorded an export.
        id: randomUUID(),
        org_id: orgId,
        // OD9.2 §31: only a genuine Project id is recorded here. `export_history` has no
        // `event_id` column, so an STO-scoped export records null rather than writing an
        // Event id into a Project column and fabricating a cross-domain mapping.
        // Adding `export_history.event_id` is logged as an OD9.4 migration candidate.
        project_id: projectId,
        format: body.format,
        filename,
        workpack_count: workpacks.length,
        activity_count: totalActivities,
        file_size_bytes: Buffer.byteLength(content, 'utf8'),
        exported_by: userId,
      },
    });
  } catch (err) {
    // Non-fatal: the export itself already succeeded. Log so a failure here is visible
    // instead of silently discarded.
    console.error('[Export] Failed to record export_history:', err);
  }

  return new Response(content, {
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : '';
    console.error('[Export Generate] Error:', message, stack);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function defaultUdf(): UdfConfig {
  return {
    discipline: true,
    contractor: true,
    window: true,
    priority: true,
    equipTag: true,
    equipDesc: true,
    equipType: true,
    plant: true,
    unit: true,
    wpNumber: true,
    manpower: false,
    predecessor: true,
  };
}

// ── CSV ─────────────────────────────────────────────────────────────
function buildCSV(
  project: { name?: string; code?: string } | null,
  workpacks: any[],
  udf: UdfConfig
) {
  const headers = [
    'WBS Path',
    'Workpack No.',
    'Activity ID',
    'Activity Name',
    'Duration (hrs)',
    'Planned Start',
    'Planned Finish',
    'Progress %',
    'Status',
    'Window',
  ];
  if (udf.discipline) headers.push('Discipline');
  if (udf.contractor) headers.push('Contractor');
  if (udf.priority) headers.push('Priority');
  if (udf.manpower) headers.push('Manpower');
  if (udf.equipTag) headers.push('Equipment Tag');
  if (udf.equipDesc) headers.push('Equipment Description');
  if (udf.equipType) headers.push('Equipment Type');
  if (udf.plant) headers.push('Plant');
  if (udf.unit) headers.push('Unit');
  if (udf.predecessor) headers.push('Predecessors');

  const rows: string[] = [headers.map((h) => `"${h}"`).join(',')];

  for (const wp of workpacks) {
    const plant = wp.unit?.plant?.name ?? wp.plant?.name ?? '';
    const unit = wp.unit?.name ?? '';
    const tag = wp.asset?.tag_number ?? wp.asset?.name ?? '';
    const wbsPath = [plant, unit, tag, wpNum(wp)].filter(Boolean).join(' > ');
    const contractorName = wp.contractor?.name ?? '';

    for (const act of wp.activities ?? []) {
      const predIds = (act.predecessors ?? [])
        .map((r: any) => r.predecessor?.activity_id ?? r.predecessor?.activityId)
        .filter(Boolean)
        .join('; ');
      const startDate = actStart(act);
      const endDate = actEnd(act);
      const row: string[] = [
        `"${esc(wbsPath)}"`,
        `"${esc(wpNum(wp))}"`,
        `"${esc(actId(act))}"`,
        `"${esc(actName(act))}"`,
        `"${esc(actDuration(act))}"`,
        `"${startDate ? startDate.toLocaleDateString('en-IN') : ''}"`,
        `"${endDate ? endDate.toLocaleDateString('en-IN') : ''}"`,
        `"${esc(actProgress(act))}"`,
        `"${esc(act.status ?? '')}"`,
        `"${esc(act.window ?? '')}"`,
      ];
      if (udf.discipline) row.push(`"${esc(act.discipline?.name ?? act.discipline?.code ?? '')}"`);
      if (udf.contractor) row.push(`"${esc(contractorName)}"`);
      if (udf.priority) row.push(`"${esc(wp.priority ?? '')}"`);
      if (udf.manpower) row.push(`"${esc(act.manpower_count ?? '')}"`);
      if (udf.equipTag) row.push(`"${esc(tag)}"`);
      if (udf.equipDesc) row.push(`"${esc(wp.asset?.description ?? '')}"`);
      if (udf.equipType) row.push(`"${esc(wp.equipment_type ?? '')}"`);
      if (udf.plant) row.push(`"${esc(plant)}"`);
      if (udf.unit) row.push(`"${esc(unit)}"`);
      if (udf.predecessor) row.push(`"${esc(predIds)}"`);
      rows.push(row.join(','));
    }
  }
  return { content: rows.join('\n') };
}

// ── MS Project XML ──────────────────────────────────────────────────
function buildMSProjectXML(
  project: { name?: string; code?: string } | null,
  workpacks: any[],
  udf: UdfConfig
) {
  let uid = 1;
  const tasks: string[] = [];

  for (const wp of workpacks) {
    const plant = wp.unit?.plant?.name ?? wp.plant?.name ?? '';
    const unit = wp.unit?.name ?? '';
    const tag = wp.asset?.tag_number ?? wp.asset?.name ?? '';
    const wbs = [plant, unit, tag, wpNum(wp)].filter(Boolean).join('.');

    tasks.push(`<Task>
  <UID>${uid++}</UID>
  <Name>${escXml(wpNum(wp) + ' — ' + (wp.title ?? ''))}</Name>
  <Summary>1</Summary>
  <WBS>${escXml(wbs)}</WBS>
  <OutlineLevel>3</OutlineLevel>
</Task>`);

    for (const act of wp.activities ?? []) {
      // MS Project requires PT[H]H[M]M[S]S format — e.g. PT8H0M0S. Default to 12 hours if no duration assigned.
      const durHours = Number(
        act.duration_hours ?? act.durationHours ?? act.duration ?? 12
      );
      const durationXml = `PT${Math.floor(durHours)}H${Math.round((durHours % 1) * 60)}M0S`;

      // MS Project requires valid dates; derive finish from start + duration when missing
      const startDate =
        act.planned_start ?? act.plannedStart ?? act.start_date ?? new Date().toISOString();
      const finishDate =
        act.planned_finish ??
        act.plannedFinish ??
        act.planned_end ??
        act.end_date ??
        new Date(new Date(startDate).getTime() + durHours * 3600000).toISOString();
      const start = new Date(startDate).toISOString();
      const finish = new Date(finishDate).toISOString();

      const tagVal = wp.asset?.tag_number ?? wp.asset?.name ?? '';
      const extVals = [
        udf.equipTag &&
          `<ExtendedAttribute><FieldID>188743731</FieldID><Value>${escXml(tagVal)}</Value></ExtendedAttribute>`,
        udf.wpNumber &&
          `<ExtendedAttribute><FieldID>188743732</FieldID><Value>${escXml(wpNum(wp))}</Value></ExtendedAttribute>`,
        udf.discipline &&
          `<ExtendedAttribute><FieldID>188743733</FieldID><Value>${escXml(act.discipline?.name ?? act.discipline?.code)}</Value></ExtendedAttribute>`,
        udf.contractor &&
          `<ExtendedAttribute><FieldID>188743734</FieldID><Value>${escXml(wp.contractor?.name)}</Value></ExtendedAttribute>`,
        udf.window &&
          `<ExtendedAttribute><FieldID>188743735</FieldID><Value>${escXml(act.window)}</Value></ExtendedAttribute>`,
        `<ExtendedAttribute><FieldID>188743736</FieldID><Value>${escXml(actId(act) || act.id)}</Value></ExtendedAttribute>`,
        udf.plant &&
          `<ExtendedAttribute><FieldID>188743737</FieldID><Value>${escXml(plant)}</Value></ExtendedAttribute>`,
        udf.unit &&
          `<ExtendedAttribute><FieldID>188743738</FieldID><Value>${escXml(unit)}</Value></ExtendedAttribute>`,
        `<ExtendedAttribute><FieldID>188743739</FieldID><Value>${escXml(act.activity_number ?? '')}</Value></ExtendedAttribute>`,
      ]
        .filter(Boolean)
        .join('\n  ');

      tasks.push(`<Task>
  <UID>${uid++}</UID>
  <Name>${escXml(actName(act))}</Name>
  <OutlineLevel>4</OutlineLevel>
  <Duration>${durationXml}</Duration>
  <Start>${start}</Start>
  <Finish>${finish}</Finish>
  <PercentComplete>${actProgress(act)}</PercentComplete>
  ${extVals}
</Task>`);
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>${escXml(project?.name ?? 'SYORITY Export')}</Name>
  <StartDate>${new Date().toISOString()}</StartDate>
  <ExtendedAttributes>
    <ExtendedAttribute><FieldID>188743731</FieldID><Alias>SY_EQUIP_TAG</Alias></ExtendedAttribute>
    <ExtendedAttribute><FieldID>188743732</FieldID><Alias>SY_WP_NUMBER</Alias></ExtendedAttribute>
    <ExtendedAttribute><FieldID>188743733</FieldID><Alias>SY_DISCIPLINE</Alias></ExtendedAttribute>
    <ExtendedAttribute><FieldID>188743734</FieldID><Alias>SY_CONTRACTOR</Alias></ExtendedAttribute>
    <ExtendedAttribute><FieldID>188743735</FieldID><Alias>SY_WINDOW</Alias></ExtendedAttribute>
    <ExtendedAttribute><FieldID>188743736</FieldID><Alias>SY_ACTIVITY_ID</Alias></ExtendedAttribute>
    <ExtendedAttribute><FieldID>188743737</FieldID><Alias>SY_PLANT</Alias></ExtendedAttribute>
    <ExtendedAttribute><FieldID>188743738</FieldID><Alias>SY_UNIT</Alias></ExtendedAttribute>
    <ExtendedAttribute><FieldID>188743739</FieldID><Alias>SY_ACTIVITY_CODE</Alias></ExtendedAttribute>
  </ExtendedAttributes>
  <Tasks>
${tasks.join('\n')}
  </Tasks>
</Project>`;
}

// ── P6 XER ──────────────────────────────────────────────────────────
function buildP6XER(
  project: { name?: string; code?: string; plannedSdDate?: Date | null } | null,
  workpacks: any[],
  _udf: UdfConfig
) {
  const lines: string[] = [
    `ERMHDR\t22\t${today()}\tProject\tAdmin\t\t\t\tUSD\t`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tproject_flag\tproj_start_date\tproj_desc',
    `%R\t1\t${project?.code ?? 'EXPORT'}\tP\t${project?.plannedSdDate ? new Date(project.plannedSdDate).toISOString().split('T')[0] : today()}\t${project?.name ?? 'SYORITY Export'}`,
    '%E',
    '%T\tPROJWBS',
    '%F\twbs_id\tproj_id\tseq_num\twbs_short_name\twbs_name',
  ];

  let wbsId = 1;
  const wbsMap = new Map<string, number>();

  for (const wp of workpacks) {
    const plant = wp.unit?.plant?.name ?? wp.plant?.name ?? 'PLANT';
    const unit = wp.unit?.name ?? 'UNIT';
    const tag = wp.asset?.tag_number ?? wp.asset?.name ?? wp.id.slice(0, 8);

    if (!wbsMap.has(plant)) {
      wbsMap.set(plant, wbsId);
      lines.push(`%R\t${wbsId++}\t1\t10\t${plant}\t${plant}`);
    }
    const unitKey = `${plant}:${unit}`;
    if (!wbsMap.has(unitKey)) {
      wbsMap.set(unitKey, wbsId);
      lines.push(`%R\t${wbsId++}\t1\t20\t${unit}\t${unit}`);
    }
    const tagKey = `${unitKey}:${tag}`;
    if (!wbsMap.has(tagKey)) {
      wbsMap.set(tagKey, wbsId);
      lines.push(
        `%R\t${wbsId++}\t1\t30\t${tag}\t${tag} ${wp.asset?.description ?? ''}`.replace(/\t/g, '\t')
      );
    }
    wbsMap.set(wp.id, wbsId);
    lines.push(
      `%R\t${wbsId++}\t1\t40\t${wpNum(wp) || wp.id.slice(0, 8)}\t${wp.title ?? ''}`.replace(
        /\t/g,
        '\t'
      )
    );
  }
  lines.push('%E');

  lines.push('%T\tTASK');
  lines.push(
    '%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\tstatus_code\ttarget_drtn_hr_cnt\tact_start_date\tact_end_date\tphys_complete_pct'
  );

  let taskId = 1;
  const taskMap = new Map<string, number>();

  for (const wp of workpacks) {
    const wpWbsId = wbsMap.get(wp.id) ?? 1;
    for (const act of wp.activities ?? []) {
      const tid = taskId++;
      const durHrs = actDuration(act);
      const pct = actProgress(act);
      const status =
        pct >= 100 ? 'TK_Complete' : pct > 0 ? 'TK_InProgress' : 'TK_NotStart';
      const actKey = actId(act) || act.id;
      taskMap.set(actKey, tid);
      const startD = actStart(act);
      const endD = actEnd(act);
      const startStr = startD ? startD.toISOString().replace('T', ' ').split('.')[0] : '';
      const endStr = endD ? endD.toISOString().replace('T', ' ').split('.')[0] : '';
      lines.push(
        [
          '%R',
          tid,
          1,
          wpWbsId,
          actId(act) || `ACT${tid}`,
          actName(act).replace(/\t/g, ' '),
          status,
          durHrs,
          startStr,
          endStr,
          pct,
        ].join('\t')
      );
    }
  }
  lines.push('%E');

  lines.push('%T\tUDFTYPE');
  lines.push('%F\tudf_type_id\tsubject_area\tudf_type_label\tudf_type_name\tlogical_data_type');
  const udfDefs = [
    [1, 'TASK', 'SY_EQUIP_TAG', 'Equipment Tag', 'LT_Text'],
    [2, 'TASK', 'SY_WP_NUMBER', 'Workpack Number', 'LT_Text'],
    [3, 'TASK', 'SY_DISCIPLINE', 'Discipline', 'LT_Text'],
    [4, 'TASK', 'SY_CONTRACTOR', 'Contractor', 'LT_Text'],
    [5, 'TASK', 'SY_WINDOW', 'Window', 'LT_Text'],
    [6, 'TASK', 'SY_PLANT', 'Plant', 'LT_Text'],
    [7, 'TASK', 'SY_UNIT', 'Unit', 'LT_Text'],
    [8, 'TASK', 'SY_PRIORITY', 'Priority', 'LT_Text'],
    [9, 'TASK', 'SY_ACTIVITY_CODE', 'Activity Code', 'LT_Text'],
  ];
  udfDefs.forEach((d) => lines.push(`%R\t${(d as any[]).join('\t')}`));
  lines.push('%E');

  lines.push('%T\tUDFVALUE');
  lines.push('%F\tudf_type_id\tfkey_id\tproj_id\ttext_value');
  for (const wp of workpacks) {
    const plant = wp.unit?.plant?.name ?? wp.plant?.name ?? '';
    const unit = wp.unit?.name ?? '';
    for (const act of wp.activities ?? []) {
      const actKey = actId(act) || act.id;
      const tid = taskMap.get(actKey) ?? 0;
      const vals: [number, string][] = [
        [1, wp.asset?.tag_number ?? wp.asset?.name ?? ''],
        [2, wpNum(wp)],
        [3, act.discipline?.name ?? act.discipline?.code ?? ''],
        [4, wp.contractor?.name ?? ''],
        [5, act.window ?? ''],
        [6, plant],
        [7, unit],
        [8, wp.priority ?? ''],
        [9, act.activity_number ?? ''],
      ];
      vals
        .filter(([, v]) => v)
        .forEach(([typeId, val]) =>
          lines.push(`%R\t${typeId}\t${tid}\t1\t${String(val).replace(/\t/g, ' ')}`)
        );
    }
  }
  lines.push('%E');

  lines.push('%T\tTASKPRED');
  lines.push('%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_type\tlag_hr_cnt');
  let predId = 1;
  for (const wp of workpacks) {
    for (const act of wp.activities ?? []) {
      const tid = taskMap.get(actId(act) || act.id);
      for (const rel of act.predecessors ?? []) {
        const predActId = rel.predecessor?.activity_id ?? rel.predecessor?.id;
        const predTid = predActId ? taskMap.get(predActId) : undefined;
        if (tid && predTid != null) {
          const relType =
            { FS: 'PR_FS', SS: 'PR_SS', FF: 'PR_FF', SF: 'PR_SF' }[
              String(rel.relationship_type ?? 'FS')
            ] ?? 'PR_FS';
          // Sprint 1a — canonical lag_minutes → hours; legacy lag_days × 24 fallback.
          const lagHrs = rel.lag_minutes != null ? Number(rel.lag_minutes) / 60 : Number(rel.lag_days ?? 0) * 24;
          lines.push(`%R\t${predId++}\t${tid}\t${predTid}\t1\t${relType}\t${lagHrs}`);
        }
      }
    }
  }
  lines.push('%E');

  return lines.join('\n');
}

// ── P6 XML ──────────────────────────────────────────────────────────
function buildP6XML(
  project: { name?: string; code?: string; plannedSdDate?: Date | null } | null,
  workpacks: any[],
  udf: UdfConfig
) {
  const activities = workpacks.flatMap((wp) =>
    (wp.activities ?? []).map((act: any) => {
      const plant = wp.unit?.plant?.name ?? wp.plant?.name ?? '';
      const unit = wp.unit?.name ?? '';
      const startD = actStart(act);
      const endD = actEnd(act);
      return `<Activity>
  <Id>${escXml(actId(act) || act.id)}</Id>
  <Name>${escXml(actName(act))}</Name>
  <PlannedDuration>${actDuration(act)}</PlannedDuration>
  <StartDate>${startD ? startD.toISOString() : ''}</StartDate>
  <FinishDate>${endD ? endD.toISOString() : ''}</FinishDate>
  <PercentComplete>${actProgress(act)}</PercentComplete>
  <Status>${act.status ?? 'Not Started'}</Status>
  ${udf.discipline ? `<UDF name="SY_DISCIPLINE">${escXml(act.discipline?.name ?? act.discipline?.code)}</UDF>` : ''}
  ${udf.contractor ? `<UDF name="SY_CONTRACTOR">${escXml(wp.contractor?.name)}</UDF>` : ''}
  ${udf.window ? `<UDF name="SY_WINDOW">${escXml(act.window)}</UDF>` : ''}
  ${udf.equipTag ? `<UDF name="SY_EQUIP_TAG">${escXml(wp.asset?.tag_number ?? wp.asset?.name)}</UDF>` : ''}
  ${udf.wpNumber ? `<UDF name="SY_WP_NUMBER">${escXml(wpNum(wp))}</UDF>` : ''}
  ${udf.plant ? `<UDF name="SY_PLANT">${escXml(plant)}</UDF>` : ''}
  ${udf.unit ? `<UDF name="SY_UNIT">${escXml(unit)}</UDF>` : ''}
  ${udf.priority ? `<UDF name="SY_PRIORITY">${escXml(wp.priority)}</UDF>` : ''}
  <UDF name="SY_ACTIVITY_CODE">${escXml(act.activity_number)}</UDF>
</Activity>`;
    })
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<APIBusinessObjects>
  <Project>
    <Id>${escXml(project?.code ?? 'EXPORT')}</Id>
    <Name>${escXml(project?.name ?? 'SYORITY Export')}</Name>
    <PlannedStartDate>${project?.plannedSdDate ? new Date(project.plannedSdDate).toISOString() : new Date().toISOString()}</PlannedStartDate>
    <Activities>
${activities.join('\n')}
    </Activities>
  </Project>
</APIBusinessObjects>`;
}
