import { NextRequest, NextResponse } from 'next/server';
import { getOrgIdFromRequest } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import { sanitiseFilename } from '@/lib/utils/filename';
import { csvToBuffer, objectsToCsv } from '@/lib/materials/csvHelper';

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const orgId = await getOrgIdFromRequest(req);
        if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const workpack = await prisma.workpack.findFirst({
            where: { id, organization_id: orgId, deleted_at: null },
            select: { workpack_id_code: true, title: true },
        });
        if (!workpack)
            return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const activities = await prisma.activity.findMany({
            where: { workpack_id: id, deleted_at: null },
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
            hold_point: a.hold_point_type ?? '',
            status: a.status ?? '',
            responsible: '',
            notes: a.notes ?? '',
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
            { key: 'hold_point', label: 'Hold Point' },
            { key: 'status', label: 'Status' },
            { key: 'responsible', label: 'Responsible Party' },
            { key: 'notes', label: 'Notes' },
        ]);

        const ref =
            workpack.workpack_id_code ?? id.slice(0, 8);
        const date = new Date()
            .toLocaleDateString('en-GB')
            .replace(/\//g, '-');
        const filename = sanitiseFilename(`Activities_${ref}_${date}.csv`);

        const buf = csvToBuffer(csv);
        return new Response(new Uint8Array(buf), {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
