import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import ExcelJS from 'exceljs';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { SAP_COLUMN_MAPPINGS, SAP_TYPE_TO_CATEGORY } from '@/lib/materials/constants';

export async function POST(req: Request) {
  const { session, error } = await guardApi('masterdata.edit');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json(
      { error: 'Expected multipart form data' },
      { status: 400 }
    );
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const batchId = randomUUID();
  const errors: { row: number; message: string }[] = [];

  let workbook: ExcelJS.Workbook;
  try {
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return NextResponse.json(
      {
        error:
          'Could not read Excel file. Ensure it is .xlsx or .xls format.',
      },
      { status: 400 }
    );
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return NextResponse.json(
      { error: 'Excel file has no worksheets' },
      { status: 400 }
    );
  }

  const headerRow = worksheet.getRow(1);
  const columnMap: Record<number, string> = {};
  headerRow.eachCell((cell, colIdx) => {
    const header = String(cell.value ?? '').trim();
    const mapped = SAP_COLUMN_MAPPINGS[header];
    if (mapped) columnMap[colIdx] = mapped;
  });

  if (Object.keys(columnMap).length === 0) {
    return NextResponse.json(
      {
        error: 'No recognised column headers found.',
        hint: 'Expected columns: MATNR, MAKTX, MEINS, MTART',
        found_headers: Array.isArray(headerRow.values) ? headerRow.values.slice(1) : undefined,
      },
      { status: 400 }
    );
  }

  const rowsToProcess: { rowIdx: number; data: Record<string, string> }[] = [];
  worksheet.eachRow((row, rowIdx) => {
    if (rowIdx === 1) return;
    if (row.actualCellCount === 0) return;

    const rowData: Record<string, string> = {};
    row.eachCell((cell, colIdx) => {
      const field = columnMap[colIdx];
      if (field) {
        const v = cell.value;
        rowData[field] = typeof v === 'string' ? v.trim() : String(v ?? '').trim();
      }
    });

    if (!rowData.description && !rowData.sap_material_number) {
      errors.push({
        row: rowIdx,
        message: 'Missing description and SAP number — skipped',
      });
      return;
    }

    rowsToProcess.push({ rowIdx, data: rowData });
  });

  let imported = 0;
  let updated = 0;
  const importedBy =
    (session!.user as any)?.email ?? (session!.user as any)?.id ?? 'system';

  for (const { rowIdx, data } of rowsToProcess) {
    try {
      const itemCode =
        data.sap_material_number ?? `IMP-${batchId.slice(0, 8)}-${rowIdx}`;
      const category = data.item_category
        ? (SAP_TYPE_TO_CATEGORY[data.item_category] ?? 'other')
        : 'other';

      const desc = data.description ?? '';
      const sizeMatch = desc.match(/(\d+(?:\.\d+)?"|\d+\/\d+")/);
      const ratingMatch = desc.match(
        /(150#|#150|#300|300#|#600|600#|#900|900#)/i
      );

      const existing = await prisma.item_catalog.findFirst({
        where: {
          organization_id: orgId,
          item_code: itemCode,
        },
        select: { id: true },
      });

      if (existing) {
        await prisma.item_catalog.update({
          where: { id: existing.id },
          data: {
            description: data.description ?? undefined,
            sap_material_number: data.sap_material_number ?? undefined,
            sap_plant: data.sap_plant ?? undefined,
            sap_storage_location: data.sap_storage_location ?? undefined,
            sap_material_group: data.sap_material_group ?? undefined,
            item_category: category,
            unit_of_measure: data.unit_of_measure ?? 'EA',
            manufacturer: data.manufacturer ?? undefined,
            manufacturer_part_no: data.manufacturer_part_no ?? undefined,
            is_active: true,
            deleted_at: null,
            last_sap_sync: new Date(),
            import_batch_id: batchId,
          },
        });
        updated++;
      } else {
        await prisma.item_catalog.create({
          data: {
            organization_id: orgId,
            item_code: itemCode,
            description: data.description ?? 'No description',
            item_category: category,
            unit_of_measure: data.unit_of_measure ?? 'EA',
            sap_material_number: data.sap_material_number ?? null,
            sap_plant: data.sap_plant ?? null,
            sap_storage_location: data.sap_storage_location ?? null,
            sap_material_group: data.sap_material_group ?? null,
            manufacturer: data.manufacturer ?? null,
            manufacturer_part_no: data.manufacturer_part_no ?? null,
            pipe_size: sizeMatch?.[1] ?? null,
            pressure_rating: ratingMatch?.[1] ?? null,
            last_sap_sync: new Date(),
            import_batch_id: batchId,
          },
        });
        imported++;
      }
    } catch (e: any) {
      errors.push({ row: rowIdx, message: e?.message ?? 'Unknown error' });
    }
  }

  await prisma.item_catalog_import_logs.create({
    data: {
      organization_id: orgId,
      batch_id: batchId,
      imported_by: importedBy,
      filename: file.name,
      total_rows: rowsToProcess.length,
      imported_count: imported,
      updated_count: updated,
      error_count: errors.length,
      errors: errors.length > 0 ? (errors as object) : undefined,
      status: 'complete',
    },
  });

  return NextResponse.json({
    success: true,
    batch_id: batchId,
    total_rows: rowsToProcess.length,
    imported,
    updated,
    errors: errors.length,
    error_details: errors.slice(0, 20),
    message: `Import complete: ${imported} new, ${updated} updated, ${errors.length} errors.`,
  });
}
