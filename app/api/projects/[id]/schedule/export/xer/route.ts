import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';
import dayjs from 'dayjs';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('workpacks.view');
  if (error) return error;

  const { id: projectId } = await params;
  const orgId = session.user.organization_id;

  const project = await prisma.project.findFirst({
    where: { id: projectId, org_id: orgId }
  });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // Get all activities for the project.
  // OD9.1: reached through the Workpack — Activity.project_id was retired.
  const activities = await prisma.activity.findMany({
    where: { workpack: { project_id: projectId }, organization_id: orgId, deleted_at: null },
    select: {
      id: true,
      activity_number: true,
      description: true,
      duration_hours: true,
      planned_start: true,
      planned_end: true,
      progress_percent: true,
      status: true,
      wbs_code: true
    }
  });

  const activityIds = activities.map(a => a.id);

  // Get all relationships between these activities
  const relationships = await prisma.activityRelationship.findMany({
    where: {
      organization_id: orgId,
      predecessor_id: { in: activityIds },
      successor_id: { in: activityIds }
    }
  });

  // Construct XER text
  const lines: string[] = [];

  // Header (XER requires a valid file header)
  lines.push('ERMHDR\t8.0'); // Standard P6 version header format
  lines.push('%T\tPROJECT');
  lines.push('%F\tproj_id\tproj_short_name');
  lines.push(`%R\t${project.id}\t${project.name}`);

  // TASK Table
  lines.push('%T\tTASK');
  lines.push('%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\tphys_complete_pct');

  activities.forEach(act => {
    let status_code = 'TK_NotStart';
    if (act.status === 'completed') status_code = 'TK_Active'; // TK_Active is standard for complete/in-progress in XER with phys_complete_pct
    else if (act.status === 'in_progress') status_code = 'TK_Active';

    // Format dates as required by XER: YYYY-MM-DD HH:mm
    const fmtDate = (d: Date | null) => d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '';

    const row = [
      '%R',
      act.id,
      project.id,
      act.wbs_code || '',
      act.activity_number || act.id.substring(0, 8),
      act.description || 'Unnamed Task',
      'TT_Task',
      status_code,
      fmtDate(act.planned_start),
      fmtDate(act.planned_end),
      act.duration_hours || 0,
      act.progress_percent || 0
    ];
    lines.push(row.join('\t'));
  });

  // TASKPRED Table (Relationships)
  if (relationships.length > 0) {
    lines.push('%T\tTASKPRED');
    lines.push('%F\ttask_pred_id\tproj_id\tpred_task_id\ttask_id\tpred_type\tlag_hr_cnt');
    
    relationships.forEach(rel => {
      let predType = 'PR_FS';
      if (rel.relationship_type === 'SS') predType = 'PR_SS';
      else if (rel.relationship_type === 'FF') predType = 'PR_FF';
      else if (rel.relationship_type === 'SF') predType = 'PR_SF';

      const row = [
        '%R',
        rel.id,
        project.id,
        rel.predecessor_id,
        rel.successor_id,
        predType,
        // Sprint 1a — canonical lag_minutes → hours; legacy lag_days × 8 fallback.
        rel.lag_minutes != null ? Number(rel.lag_minutes) / 60 : (rel.lag_days || 0) * 8
      ];
      lines.push(row.join('\t'));
    });
  }

  // End of file
  lines.push('%E');

  const content = lines.join('\r\n');

  // Return text file
  const response = new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Content-Disposition': `attachment; filename="${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_schedule.xer"`
    }
  });

  return response;
});
