import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { guardApi, orgScope } from '@/lib/apiGuard';

const HEADERS = [
  'tag_number',
  'name',
  'asset_type',
  'unit_code',
  'system_code',
  'manufacturer',
  'design_pressure_barg',
  'design_temp_c',
  'weight_empty_kg',
  'criticality',
  'sap_equipment_number',
  'sap_functional_location',
  'p_and_id_numbers',
];

const EXAMPLE_ROWS = [
  ['E-101A', 'Crude/Vacuum Feed Effluent Exchanger', 'heat_exchanger', 'FCC', 'Fractionation', 'ABC Inc', '25', '400', '5000', 'A', 'EQ-101A', 'FL-FCC-101', 'P-FCC-001 Rev B'],
  ['P-201A', 'Bottoms Pump', 'pump', 'FCC', 'Fractionation', '', '10', '200', '800', 'B', '', '', 'P-FCC-002'],
  ['V-301', 'Flash Drum', 'vessel', 'CDU', 'Preheat', 'XYZ', '15', '350', '12000', 'A', 'EQ-301', 'FL-CDU-301', 'P-CDU-001, P-CDU-002'],
];

export async function GET() {
  const { session, error } = await guardApi('masterdata.view');
  if (error) return error;
  orgScope(session!);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Assets', { views: [{ state: 'frozen', ySplit: 1 }] });

  sheet.addRow(HEADERS);
  for (const row of EXAMPLE_ROWS) {
    sheet.addRow(row);
  }

  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((col, i) => {
    if (col) col.width = Math.max(HEADERS[i]?.length ?? 10, 12);
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer as unknown as Blob, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="asset_register_template.xlsx"',
    },
  });
}
