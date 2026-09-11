import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { objectsToCsv } from '@/lib/materials/csvHelper';
import { sanitiseFilename } from '@/lib/utils/filename';

/**
 * POST /api/export/bundle-zip
 * One CSV file per workpack inside a ZIP archive (thin wrapper over per-workpack activity export).
 */
export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const body = (await req.json().catch(() => ({}))) as { workpackIds?: string[] };
  const workpackIds = Array.isArray(body.workpackIds)
    ? body.workpackIds.map((id) => String(id).trim()).filter(Boolean)
    : [];

  if (workpackIds.length === 0) {
    return NextResponse.json({ error: 'workpackIds array is required' }, { status: 400 });
  }
  if (workpackIds.length > 50) {
    return NextResponse.json({ error: 'Maximum 50 workpacks per bundle' }, { status: 400 });
  }

  const workpacks = await prisma.workpack.findMany({
    where: { id: { in: workpackIds }, organization_id: orgId, deleted_at: null },
    select: { id: true, workpack_id_code: true, workpack_number: true, title: true },
  });

  if (workpacks.length === 0) {
    return NextResponse.json({ error: 'No workpacks found' }, { status: 404 });
  }

  const zip = new JSZip();

  for (const wp of workpacks) {
    const activities = await prisma.activity.findMany({
      where: { workpack_id: wp.id, deleted_at: null },
      orderBy: { sequence_number: 'asc' },
      include: { discipline: true },
    });

    const rows = activities.map((a) => ({
      seq: a.sequence_number ?? '',
      code: a.activity_number ?? '',
      description: a.description ?? '',
      discipline: a.discipline?.code ?? a.discipline?.name ?? '',
      duration: a.duration_hours ?? '',
      start: a.planned_start
        ? new Date(a.planned_start).toLocaleDateString('en-GB')
        : '',
      end: a.planned_end
        ? new Date(a.planned_end).toLocaleDateString('en-GB')
        : '',
      progress: a.progress_percent ?? 0,
      status: a.status ?? '',
    }));

    const csv = objectsToCsv(rows, [
      { key: 'seq', label: 'Seq #' },
      { key: 'code', label: 'Activity Code' },
      { key: 'description', label: 'Description' },
      { key: 'discipline', label: 'Discipline' },
      { key: 'duration', label: 'Duration (hrs)' },
      { key: 'start', label: 'Planned Start' },
      { key: 'end', label: 'Planned End' },
      { key: 'progress', label: 'Progress %' },
      { key: 'status', label: 'Status' },
    ]);
    const baseName = sanitiseFilename(
      wp.workpack_id_code ?? wp.workpack_number ?? wp.id.slice(0, 8)
    );
    zip.file(`${baseName}-activities.csv`, csv);
  }

  const buffer = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
  const stamp = new Date().toISOString().split('T')[0];

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="workpack-activities-${stamp}.zip"`,
    },
  });
}
