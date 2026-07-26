import { NextRequest, NextResponse } from 'next/server';
import { getOrgIdFromRequest } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import { sanitiseFilename } from '@/lib/utils/filename';
import ExcelJS from 'exceljs';

/**
 * GET /api/workpacks/[id]/export/activities-excel
 * Returns an Excel file with activity register: Seq#, Code, Description, Duration,
 * Plan Start, Plan End, Actual Start, Actual End, Progress%, Status, Discipline,
 * Hold Point, QA Witness, Welding Qty, Scaffolding Qty, Predecessors, Notes.
 */
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
            include: {
                activities: {
                    where: { deleted_at: null },
                    orderBy: { sequence_number: 'asc' },
                    include: {
                        udf_values: {
                            include: {
                                definition: { select: { code: true } },
                                option: { select: { description: true, code_value: true } },
                            },
                        },
                        predecessors: { select: { predecessor_id: true } },
                    },
                },
            },
        });

        if (!workpack) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Activities', { views: [{ state: 'frozen', ySplit: 1 }] });

        const headerRow = [
            'Seq#',
            'Code',
            'Description',
            'Duration (h)',
            'Plan Start',
            'Plan End',
            'Actual Start',
            'Actual End',
            'Progress %',
            'Status',
            'Discipline',
            'Hold Point',
            'QA Witness',
            'Welding Qty',
            'Scaffolding Qty',
            'Predecessors',
            'Notes',
        ];
        sheet.addRow(headerRow);
        const header = sheet.getRow(1);
        header.font = { bold: true };
        header.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1e3a5f' },
        };
        header.font = { bold: true, color: { argb: 'FFFFFFFF' } };

        const getUdf = (act: { udf_values?: Array<{ definition?: { code: string } | null; option?: { description?: string; code_value?: string } | null; value_string?: string | null; value_number?: unknown }> }, code: string) => {
            const v = act.udf_values?.find((u) => u.definition?.code === code);
            if (!v) return '';
            const d = v.option?.description ?? v.option?.code_value ?? v.value_string;
            if (d != null) return String(d);
            if (v.value_number != null) return String(v.value_number);
            return '';
        };

        const activities = workpack.activities as Array<{
            id: string;
            sequence_number: number | null;
            activity_number: string | null;
            description: string;
            duration_hours: unknown;
            planned_start: Date | null;
            planned_end: Date | null;
            actual_start: Date | null;
            actual_end: Date | null;
            progress_percent: number | null;
            status: string | null;
            notes: string | null;
            udf_values?: Array<{ definition?: { code: string } | null; option?: { description?: string; code_value?: string } | null; value_string?: string | null; value_number?: unknown }>;
            predecessors?: Array<{ predecessor_id: string }>;
        }>;

        const idToSeq = new Map<string, number>();
        activities.forEach((a, i) => idToSeq.set(a.id, (a.sequence_number ?? i + 1)));

        for (const act of activities) {
            const predSeqs = (act.predecessors ?? [])
                .map((p) => idToSeq.get(p.predecessor_id))
                .filter((n): n is number => n != null)
                .sort((a, b) => a - b);
            sheet.addRow([
                act.sequence_number ?? '',
                act.activity_number ?? '',
                act.description ?? '',
                act.duration_hours != null ? Number(act.duration_hours) : '',
                act.planned_start ? new Date(act.planned_start).toLocaleDateString() : '',
                act.planned_end ? new Date(act.planned_end).toLocaleDateString() : '',
                act.actual_start ? new Date(act.actual_start).toLocaleDateString() : '',
                act.actual_end ? new Date(act.actual_end).toLocaleDateString() : '',
                act.progress_percent ?? 0,
                act.status ?? '',
                getUdf(act, 'discipline'),
                getUdf(act, 'hold_point_type'),
                getUdf(act, 'qa_witness_party'),
                getUdf(act, 'welding_qty'),
                getUdf(act, 'scaffolding_qty'),
                predSeqs.join(', '),
                act.notes ?? '',
            ]);
        }

        sheet.columns.forEach((col, i) => {
            col.width = i === 2 ? 40 : Math.min(18, (col.width ?? 10) + 2);
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const filename = sanitiseFilename(`${workpack.workpack_number ?? workpack.id}-activities.xlsx`);

        return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
