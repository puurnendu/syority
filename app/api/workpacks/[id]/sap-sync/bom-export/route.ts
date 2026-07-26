import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/workpacks/[id]/sap-sync/bom-export
 * Returns a CSV download of all WorkpackMaterialLine rows in SAP BOM format.
 *
 * CSV columns:
 *   SAP Material No, Item Code, Description, Quantity Required, Qty Issued,
 *   Unit of Measure, Category, Is Critical, SAP Work Order, Source, Status, Notes
 *
 * Usage: Manually import into SAP MM/PM as a reservation list.
 * Live SAP RFC integration is planned for Sprint 23 (Integrations Hub).
 */
export async function GET(
    _req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { session, error } = await guardApi('workpacks.view');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { id: workpackId } = await context.params;

    const workpack = await prisma.workpack.findFirst({
        where: { id: workpackId, organization_id: orgId, deleted_at: null },
        select: {
            workpack_number: true,
            workpack_id_code: true,
            title: true,
            sap_work_order: true,
        },
    });
    if (!workpack) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const lines = await prisma.workpackMaterialLine.findMany({
        where: { workpack_id: workpackId, deleted_at: null, includedInPdf: true },
        orderBy: [{ material_category: 'asc' }, { description: 'asc' }],
    });

    const safeCell = (v: unknown) => {
        const s = String(v ?? '');
        return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
    };

    const headers = [
        'SAP Material No',
        'Item Code',
        'Description',
        'Quantity Required',
        'Qty Issued',
        'Unit of Measure',
        'Category',
        'Is Critical',
        'SAP Work Order',
        'Source',
        'Procurement Status',
        'Notes',
    ];

    const rows = lines.map((l) => [
        safeCell(l.sap_material_number),
        safeCell(l.item_code),
        safeCell(l.description),
        safeCell(l.quantity_required),
        safeCell(l.quantity_issued),
        safeCell(l.unit_of_measure),
        safeCell(l.material_category),
        safeCell(l.is_critical ? 'Yes' : 'No'),
        safeCell(workpack.sap_work_order),
        safeCell(l.source_type),
        safeCell(l.procurement_status),
        safeCell(l.notes),
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\r\n');
    const wpRef = workpack.workpack_number ?? workpack.workpack_id_code ?? workpackId;
    const filename = `BOM-${wpRef.replace(/[^A-Za-z0-9-]/g, '_')}.csv`;

    return new Response(csv, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-cache',
        },
    });
}
