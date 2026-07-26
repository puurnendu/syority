import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const orgId = (session.user as any).organization_id;
  const { type } = await params;
  const body = await req.json();

  try {
    let result;
    switch (type) {
      case 'site':
        result = await prisma.site.create({ data: { organization_id: orgId, name: body.name, code: body.code } });
        break;
      case 'plant':
        result = await prisma.plant.create({ data: { organization_id: orgId, site_id: body.site_id, name: body.name, code: body.code } });
        break;
      case 'unit':
        result = await prisma.unit.create({ data: { organization_id: orgId, site_id: body.site_id, plant_id: body.plant_id, name: body.name, code: body.code } });
        break;
      case 'system':
        result = await prisma.system.create({ data: { organization_id: orgId, site_id: body.site_id, unit_id: body.unit_id, name: body.name, code: body.code } });
        break;
      case 'asset':
        result = await prisma.asset.create({ 
          data: { 
            organization_id: orgId, 
            site_id: body.site_id, 
            system_id: body.system_id, 
            tag_number: body.tag_number,
            name: body.name,
            asset_type: body.asset_type
          } 
        });
        break;
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
