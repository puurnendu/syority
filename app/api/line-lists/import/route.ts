import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import * as xlsx from 'xlsx';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const orgId = (session.user as any).organization_id;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const siteId = formData.get('site_id') as string;
    const unitId = formData.get('unit_id') as string;

    if (!file || !siteId || !unitId) {
      throw new Error('File, site_id, and unit_id are required');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = xlsx.read(buffer, { type: 'buffer' });

    // Assuming first sheet is Line List
    const lineSheetName = workbook.SheetNames[0];
    const lineSheet = workbook.Sheets[lineSheetName];
    const lineData: any[] = xlsx.utils.sheet_to_json(lineSheet);

    let linesImported = 0;
    for (const row of lineData) {
      if (!row['Line Number']) continue;
      
      await prisma.lineList.upsert({
        where: {
          organization_id_line_number: {
            organization_id: orgId,
            line_number: String(row['Line Number'])
          }
        },
        update: {
          nominal_size_inches: row['Size'] ? parseFloat(row['Size']) : null,
          pipe_class: String(row['Spec'] || ''),
          site_id: siteId,
          unit_id: unitId
        },
        create: {
          organization_id: orgId,
          site_id: siteId,
          unit_id: unitId,
          line_number: String(row['Line Number']),
          nominal_size_inches: row['Size'] ? parseFloat(row['Size']) : null,
          pipe_class: String(row['Spec'] || '')
        }
      });
      linesImported++;
    }

    // Assuming second sheet is Joint Master if it exists
    let jointsImported = 0;
    if (workbook.SheetNames.length > 1) {
      const jointSheetName = workbook.SheetNames[1];
      const jointSheet = workbook.Sheets[jointSheetName];
      const jointData: any[] = xlsx.utils.sheet_to_json(jointSheet);

      for (const row of jointData) {
        if (!row['Joint Number']) continue;
        
        await prisma.jointMaster.upsert({
          where: {
            organization_id_joint_number: {
              organization_id: orgId,
              joint_number: String(row['Joint Number'])
            }
          },
          update: {
            joint_type: String(row['Type'] || 'flanged'),
            nominal_size_inches: row['Size'] ? parseFloat(row['Size']) : null,
            pressure_rating: String(row['Rating'] || ''),
            site_id: siteId
          },
          create: {
            organization_id: orgId,
            site_id: siteId,
            joint_number: String(row['Joint Number']),
            joint_type: String(row['Type'] || 'flanged'),
            nominal_size_inches: row['Size'] ? parseFloat(row['Size']) : null,
            pressure_rating: String(row['Rating'] || ''),
          }
        });
        jointsImported++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      linesImported, 
      jointsImported 
    });

  } catch (error: any) {
    console.error('Import Error:', error);
    return NextResponse.json({ error: error.message || 'Import failed' }, { status: 500 });
  }
}
