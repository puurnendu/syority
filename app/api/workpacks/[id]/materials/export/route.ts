import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { sanitiseFilename } from '@/lib/utils/filename';
import { objectsToCsv, csvToBuffer } from '@/lib/materials/csvHelper';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { session, error } = await guardApi('workpacks.export.pdf');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await context.params;

  const url = new URL(req.url);
  const format = url.searchParams.get('format') ?? 'excel';

  const workpack = await prisma.workpack.findFirst({
    where: { id, organization_id: orgId, deleted_at: null },
    select: {
      workpack_number: true,
      title: true,
      site: { select: { name: true } },
    },
  });
  if (!workpack)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const lines = await prisma.workpack_material_lines.findMany({
    where: { workpack_id: id, deleted_at: null },
    orderBy: [{ source_type: 'asc' }, { created_at: 'asc' }],
  });

  const wpRef = workpack.workpack_number ?? id.slice(0, 8);
  const now = new Date().toLocaleDateString('en-GB');

  const rows = lines.map((l) => ({
    source: l.source_type,
    sap_number: l.sap_material_number ?? '',
    item_code: l.item_code ?? '',
    description: l.description,
    specification: l.specification ?? '',
    quantity: l.quantity_required,
    uom: l.unit_of_measure,
    unit_cost: l.unit_cost ?? '',
    total_cost:
      l.unit_cost != null
        ? (l.unit_cost * l.quantity_required).toFixed(2)
        : '',
    currency: '',
    status: l.procurement_status,
    critical: l.is_critical ? 'YES' : '',
    plant: '',
    storage_loc: '',
    manufacturer: '',
    mfr_part_no: '',
    notes: l.notes ?? '',
  }));

  if (format === 'excel') {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SYORITY';

    const ws1 = wb.addWorksheet('All Material Lines');
    ws1.addRow([`Materials Schedule — ${workpack.title}`]);
    ws1.addRow([
      `Workpack: ${wpRef}  |  Site: ${(workpack as any).site?.name ?? ''}  |  Date: ${now}`,
    ]);
    ws1.addRow([]);

    const headers = [
      'Source',
      'SAP Material No.',
      'Item Code',
      'Description',
      'Specification',
      'Qty',
      'UOM',
      'Unit Cost',
      'Total Cost',
      'Currency',
      'Status',
      'Critical',
      'Plant',
      'Stor. Loc',
      'Manufacturer',
      'Mfr Part No.',
      'Notes',
    ];
    const headerRow = ws1.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0D2137' },
    };
    headerRow.height = 20;

    ws1.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];

    const widths = [12, 18, 14, 45, 30, 8, 6, 10, 10, 8, 15, 8, 8, 8, 20, 16, 30];
    widths.forEach((w, i) => {
      ws1.getColumn(i + 1).width = w;
    });

    const SOURCES = ['joint', 'activity', 'blind', 'direct'];
    const SOURCE_COLORS: Record<string, string> = {
      joint: 'FFE8F4FD',
      activity: 'FFF0FDF4',
      blind: 'FFFEF9C3',
      direct: 'FFFFF7F0',
    };
    const SOURCE_LABELS: Record<string, string> = {
      joint: 'FROM JOINT REGISTER',
      activity: 'FROM ACTIVITIES',
      blind: 'FROM BLIND REGISTER',
      direct: 'DIRECT ADDITIONS',
    };

    for (const source of SOURCES) {
      const sourceRows = rows.filter((r) => r.source === source);
      if (sourceRows.length === 0) continue;

      const secRow = ws1.addRow([SOURCE_LABELS[source]]);
      secRow.font = { bold: true, italic: true, size: 10 };
      secRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: SOURCE_COLORS[source] },
      };

      for (const r of sourceRows) {
        const dataRow = ws1.addRow([
          r.source,
          r.sap_number,
          r.item_code,
          r.description,
          r.specification,
          r.quantity,
          r.uom,
          r.unit_cost,
          r.total_cost,
          r.currency,
          r.status,
          r.critical,
          r.plant,
          r.storage_loc,
          r.manufacturer,
          r.mfr_part_no,
          r.notes,
        ]);
        if (r.critical === 'YES') {
          dataRow.getCell(12).font = {
            bold: true,
            color: { argb: 'FFDC2626' },
          };
        }
      }
    }

    const ws2 = wb.addWorksheet('Consolidated List');
    ws2.addRow([`Consolidated Materials — ${workpack.title}`]);
    ws2.addRow([`Workpack: ${wpRef}  |  Date: ${now}`]);
    ws2.addRow([]);

    const consHeaders = [
      'SAP Material No.',
      'Item Code',
      'Description',
      'Specification',
      'Total Qty',
      'UOM',
      'Unit Cost',
      'Total Cost',
      'Currency',
      'Sources',
    ];
    const consHeaderRow = ws2.addRow(consHeaders);
    consHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    consHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0D2137' },
    };

    const consMap: Record<string, any> = {};
    for (const r of rows) {
      const key = r.sap_number || r.item_code || r.description.toLowerCase();
      if (consMap[key]) {
        consMap[key].quantity += Number(r.quantity);
        if (!consMap[key].sources.includes(r.source)) {
          consMap[key].sources.push(r.source);
        }
      } else {
        consMap[key] = { ...r, sources: [r.source] };
      }
    }

    const consCols = [18, 14, 45, 30, 10, 6, 10, 10, 8, 20];
    consCols.forEach((w, i) => {
      ws2.getColumn(i + 1).width = w;
    });

    for (const r of Object.values(consMap)) {
      const totalCost =
        r.unit_cost != null
          ? (Number(r.unit_cost) * r.quantity).toFixed(2)
          : '';
      ws2.addRow([
        r.sap_number,
        r.item_code,
        r.description,
        r.specification,
        r.quantity,
        r.uom,
        r.unit_cost,
        totalCost,
        r.currency,
        r.sources.join(', '),
      ]);
    }

    const excelBuffer = await wb.xlsx.writeBuffer();
    const filename = sanitiseFilename(`Materials_${wpRef}_${now.replace(/\//g, '-')}.xlsx`);

    return new Response(new Uint8Array(excelBuffer as ArrayBuffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  if (format === 'sap_csv') {
    const sapMap: Record<string, any> = {};
    for (const r of rows) {
      if (!r.sap_number) continue;
      if (sapMap[r.sap_number]) {
        sapMap[r.sap_number].MENGE += r.quantity;
      } else {
        sapMap[r.sap_number] = {
          MATNR: r.sap_number,
          MAKTX: r.description,
          MENGE: r.quantity,
          MEINS: r.uom,
          WERKS: r.plant || '',
          LGORT: r.storage_loc || '',
          TXTZ: `${wpRef} — ${workpack.title}`,
          PRDAT: '',
        };
      }
    }

    const csv = objectsToCsv(Object.values(sapMap), [
      { key: 'MATNR', label: 'MATNR' },
      { key: 'MAKTX', label: 'MAKTX' },
      { key: 'MENGE', label: 'MENGE' },
      { key: 'MEINS', label: 'MEINS' },
      { key: 'WERKS', label: 'WERKS' },
      { key: 'LGORT', label: 'LGORT' },
      { key: 'TXTZ', label: 'TXTZ' },
      { key: 'PRDAT', label: 'PRDAT' },
    ]);

    const filename = sanitiseFilename(`SAP_PR_${wpRef}_${now.replace(/\//g, '-')}.csv`);
    return new Response(new Uint8Array(csvToBuffer(csv)), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  const consMap2: Record<string, any> = {};
  for (const r of rows) {
    const key =
      r.sap_number || r.item_code || r.description.toLowerCase();
    if (consMap2[key]) {
      consMap2[key].quantity += Number(r.quantity);
    } else {
      consMap2[key] = { ...r };
    }
  }
  for (const row of Object.values(consMap2)) {
    row.total_cost =
      row.unit_cost != null
        ? (Number(row.unit_cost) * row.quantity).toFixed(2)
        : '';
  }

  const csv = objectsToCsv(Object.values(consMap2), [
    { key: 'sap_number', label: 'SAP Material No.' },
    { key: 'item_code', label: 'Item Code' },
    { key: 'description', label: 'Description' },
    { key: 'specification', label: 'Specification' },
    { key: 'quantity', label: 'Qty' },
    { key: 'uom', label: 'UOM' },
    { key: 'unit_cost', label: 'Unit Cost' },
    { key: 'total_cost', label: 'Total Cost' },
    { key: 'currency', label: 'Currency' },
    { key: 'status', label: 'Procurement Status' },
  ]);

  const filename = sanitiseFilename(`Materials_${wpRef}_${now.replace(/\//g, '-')}.csv`);
  return new Response(new Uint8Array(csvToBuffer(csv)), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
