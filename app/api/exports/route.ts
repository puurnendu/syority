import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';

export const GET = withTenantGuard(async (req: NextRequest, _ctx, session) => {
  const orgId = session.user.organization_id;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');

  if (!type || !['workpacks', 'joints', 'blinds', 'punch'].includes(type)) {
    return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SYORITY System';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet(type.toUpperCase());

  try {
    if (type === 'workpacks') {
      const data = await prisma.workpack.findMany({
        where: { organization_id: orgId, deleted_at: null },
        include: {
          asset: { select: { tag_number: true, description: true } },
          unit: { select: { name: true, code: true } }
        },
        orderBy: { created_at: 'desc' }
      });

      worksheet.columns = [
        { header: 'Workpack Number', key: 'wp_no', width: 20 },
        { header: 'Unit', key: 'unit', width: 15 },
        { header: 'Asset Tag', key: 'asset_tag', width: 20 },
        { header: 'Asset Desc', key: 'asset_desc', width: 30 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Type', key: 'type', width: 15 },
        { header: 'Created At', key: 'created', width: 20 },
      ];

      data.forEach(d => {
        worksheet.addRow({
          wp_no: d.workpack_number,
          unit: d.unit?.code || d.unit?.name || '',
          asset_tag: d.asset?.tag_number || '',
          asset_desc: d.asset?.description || '',
          status: d.status,
          type: d.workpack_type || '',
          created: d.created_at.toISOString().split('T')[0]
        });
      });
    }

    if (type === 'joints') {
      const data = await prisma.systemJoint.findMany({
        where: { workpack: { organization_id: orgId } },
        include: { workpack: { select: { workpack_number: true } } }
      });
      worksheet.columns = [
        { header: 'Joint Name', key: 'name', width: 20 },
        { header: 'Workpack', key: 'wp', width: 20 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Type', key: 'type', width: 15 },
        { header: 'Rating', key: 'rating', width: 10 },
        { header: 'Size', key: 'size', width: 10 },
      ];
      data.forEach(d => {
        worksheet.addRow({
          name: d.joint_name,
          wp: d.workpack?.workpack_number || '',
          status: d.status,
          type: d.joint_type || '',
          rating: d.rating || '',
          size: d.size || ''
        });
      });
    }

    if (type === 'blinds') {
      const data = await prisma.systemBlind.findMany({
        where: { workpack: { organization_id: orgId } },
        include: { workpack: { select: { workpack_number: true } } }
      });
      worksheet.columns = [
        { header: 'Blind No', key: 'no', width: 20 },
        { header: 'Workpack', key: 'wp', width: 20 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Type', key: 'type', width: 15 },
        { header: 'Location', key: 'location', width: 25 },
        { header: 'Installed', key: 'installed', width: 15 },
        { header: 'Removed', key: 'removed', width: 15 },
      ];
      data.forEach(d => {
        worksheet.addRow({
          no: d.blind_number,
          wp: d.workpack?.workpack_number || '',
          status: d.status,
          type: d.blind_type || '',
          location: d.location || '',
          installed: d.installed_at ? 'Yes' : 'No',
          removed: d.removed_at ? 'Yes' : 'No',
        });
      });
    }

    if (type === 'punch') {
      const data = await prisma.punchListItem.findMany({
        where: { organization_id: orgId, deleted_at: null },
        include: { workpack: { select: { workpack_number: true } } }
      });
      worksheet.columns = [
        { header: 'ID', key: 'id', width: 15 },
        { header: 'Workpack', key: 'wp', width: 20 },
        { header: 'Category', key: 'cat', width: 10 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Description', key: 'desc', width: 40 },
        { header: 'Assigned To', key: 'assigned', width: 20 },
      ];
      data.forEach(d => {
        worksheet.addRow({
          id: d.id.split('-')[0],
          wp: d.workpack?.workpack_number || '',
          cat: d.category,
          status: d.status,
          desc: d.description,
          assigned: d.assigned_to || ''
        });
      });
    }

    // Format header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    const buffer = await workbook.xlsx.writeBuffer();
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${type}_export_${new Date().toISOString().split('T')[0]}.xlsx"`,
      }
    });
  } catch (error: any) {
    console.error('Export Error:', error);
    return NextResponse.json({ error: 'Failed to generate export' }, { status: 500 });
  }
});
