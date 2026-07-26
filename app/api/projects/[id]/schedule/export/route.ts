import { NextRequest, NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';

export const GET = withTenantGuard(async (req: NextRequest, { params }, session) => {
  const { error } = await guardApi('projects.view');
  if (error) return error;

  const { id: projectId } = await params;
  const orgId = session.user.organization_id;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId, organization_id: orgId },
      select: { name: true, projectCode: true }
    });

    if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const activities = await prisma.activity.findMany({
      where: {
        organization_id: orgId,
        workpack: { project_id: projectId },
        deleted_at: null,
      },
      orderBy: [
        { planned_start: 'asc' },
        { sequence_number: 'asc' }
      ]
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SYORITY Platform';
    const sheet = workbook.addWorksheet('Project Schedule');

    sheet.columns = [
      { header: 'Activity ID', key: 'id', width: 20 },
      { header: 'WBS / Workpack', key: 'wbs', width: 25 },
      { header: 'Task Name', key: 'name', width: 45 },
      { header: 'Duration (Days)', key: 'duration', width: 15 },
      { header: 'Planned Start', key: 'start', width: 18 },
      { header: 'Planned Finish', key: 'finish', width: 18 },
      { header: 'Progress (%)', key: 'progress', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Critical', key: 'critical', width: 12 },
    ];

    // Format headers
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };

    activities.forEach(act => {
      sheet.addRow({
        id: act.activity_number || act.activity_id || '—',
        wbs: act.wbs_code || '—',
        name: act.description,
        duration: act.duration_hours ? (Number(act.duration_hours) / 10).toFixed(1) : '0',  // Assuming 10h/day for generic schedules
        start: act.planned_start ? new Date(act.planned_start).toLocaleDateString() : '—',
        finish: act.planned_end ? new Date(act.planned_end).toLocaleDateString() : '—',
        progress: act.progress_percent ?? 0,
        status: act.status ? act.status.replace(/_/g, ' ') : 'Not Started',
        critical: act.is_critical ? 'Yes' : 'No'
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Schedule_${project.projectCode || project.name}.xlsx"`,
      },
    });

  } catch (err: any) {
    console.error('[Export API] Excel generation failed:', err);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
});
