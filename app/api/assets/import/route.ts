import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

function normalizeHeader(h: string): string {
  const key = h.trim().toLowerCase().replace(/\s+/g, '_');
  const map: Record<string, string> = {
    tag_number: 'tag_number',
    name: 'name',
    asset_type: 'asset_type',
    unit_code: 'unit_code',
    system_code: 'system_code',
    manufacturer: 'manufacturer',
    design_pressure_barg: 'design_pressure_barg',
    design_temp_c: 'design_temp_c',
    weight_empty_kg: 'weight_empty_kg',
    criticality: 'criticality',
    sap_equipment_number: 'sap_equipment_number',
    sap_functional_location: 'sap_functional_location',
    p_and_id_numbers: 'p_and_id_numbers',
  };
  return map[key] ?? '';
}

export async function POST(req: Request) {
  const { session, error } = await guardApi('masterdata.edit');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  const siteId = (formData.get('site_id') as string)?.trim();
  if (!siteId) return NextResponse.json({ error: 'site_id is required' }, { status: 400 });

  const site = await prisma.site.findFirst({
    where: { id: siteId, organization_id: orgId },
    select: { id: true },
  });
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const errors: { row: number; message: string }[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  let workbook: ExcelJS.Workbook;
  try {
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return NextResponse.json({ error: 'Could not read Excel file. Ensure it is .xlsx format.' }, { status: 400 });
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return NextResponse.json({ error: 'Excel file has no worksheets' }, { status: 400 });

  const headerRow = worksheet.getRow(1);
  const columnMap: Record<number, string> = {};
  headerRow.eachCell((cell, colIdx) => {
    const mapped = normalizeHeader(String(cell.value ?? '').trim());
    if (mapped) columnMap[colIdx] = mapped;
  });

  if (!Object.values(columnMap).includes('tag_number') || !Object.values(columnMap).includes('name')) {
    return NextResponse.json({
      error: 'Required column headers missing. Required: tag_number, name.',
      found_headers: Array.isArray(headerRow.values) ? headerRow.values.slice(1) : undefined,
    }, { status: 400 });
  }

  const rowsToProcess: { rowIdx: number; data: Record<string, string> }[] = [];
  worksheet.eachRow((row, rowIdx) => {
    if (rowIdx === 1) return;
    if (row.actualCellCount === 0) return;
    const rowData: Record<string, string> = {};
    row.eachCell((cell, colIdx) => {
      const field = columnMap[colIdx];
      if (field) rowData[field] = typeof cell.value === 'string' ? cell.value.trim() : String(cell.value ?? '').trim();
    });
    if (!rowData.tag_number?.trim()) { errors.push({ row: rowIdx, message: 'Missing tag_number' }); return; }
    if (!rowData.name?.trim()) { errors.push({ row: rowIdx, message: 'Missing name' }); return; }
    rowsToProcess.push({ rowIdx, data: rowData });
  });

  for (const { rowIdx, data } of rowsToProcess) {
    try {
      const tag = data.tag_number!.trim().toUpperCase();
      let systemId: string | null = null;
      if (data.unit_code?.trim()) {
        const unit = await prisma.unit.findFirst({
          where: { site_id: siteId, organization_id: orgId, code: { equals: data.unit_code!.trim(), mode: 'insensitive' } },
          select: { id: true },
        });
        if (!unit) {
          errors.push({ row: rowIdx, message: 'Unit not found: ' + data.unit_code });
          skipped++;
          continue;
        }
        if (data.system_code?.trim()) {
          const sys = await prisma.system.findFirst({
            where: { unit_id: unit.id, organization_id: orgId, code: { equals: data.system_code!.trim(), mode: 'insensitive' } },
            select: { id: true },
          });
          if (sys) systemId = sys.id;
        }
      }

      const pAndIdNumbers = data.p_and_id_numbers ? data.p_and_id_numbers.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean) : [];
      const existing = await prisma.asset.findUnique({
        where: { organization_id_tag_number: { organization_id: orgId, tag_number: tag } },
        select: { id: true },
      });

      if (existing) {
        await prisma.asset.update({
          where: { id: existing.id },
          data: {
            name: data.name!.trim(),
            asset_type: data.asset_type?.trim() ?? null,
            system_id: systemId,
            manufacturer: data.manufacturer?.trim() ?? null,
            design_pressure_barg: data.design_pressure_barg ? parseFloat(data.design_pressure_barg) : null,
            design_temp_c: data.design_temp_c ? parseFloat(data.design_temp_c) : null,
            weight_empty_kg: data.weight_empty_kg ? parseFloat(data.weight_empty_kg) : null,
            criticality: data.criticality?.trim() ?? null,
            sap_equipment_number: data.sap_equipment_number?.trim() ?? null,
            sap_functional_location: data.sap_functional_location?.trim() ?? null,
            p_and_id_numbers: pAndIdNumbers,
          },
        });
        updated++;
      } else {
        await prisma.asset.create({
          data: {
            organization_id: orgId,
            site_id: siteId,
            system_id: systemId,
            tag_number: tag,
            name: data.name!.trim(),
            asset_type: data.asset_type?.trim() ?? null,
            manufacturer: data.manufacturer?.trim() ?? null,
            design_pressure_barg: data.design_pressure_barg ? parseFloat(data.design_pressure_barg) : null,
            design_temp_c: data.design_temp_c ? parseFloat(data.design_temp_c) : null,
            weight_empty_kg: data.weight_empty_kg ? parseFloat(data.weight_empty_kg) : null,
            criticality: data.criticality?.trim() ?? null,
            sap_equipment_number: data.sap_equipment_number?.trim() ?? null,
            sap_functional_location: data.sap_functional_location?.trim() ?? null,
            p_and_id_numbers: pAndIdNumbers,
            created_by: userId,
          },
        });
        created++;
      }
    } catch (e: unknown) {
      errors.push({ row: rowIdx, message: e instanceof Error ? e.message : 'Unknown error' });
    }
  }

  return NextResponse.json({
    created,
    updated,
    skipped,
    errors: errors.slice(0, 50),
    message: `Import complete: ${created} created, ${updated} updated, ${skipped} skipped, ${errors.length} errors.`,
  });
}
