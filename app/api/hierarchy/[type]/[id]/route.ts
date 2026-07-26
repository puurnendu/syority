import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ type: string, id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const orgId = (session.user as any).organization_id;
  const { type, id } = await params;
  const body = await req.json();

  try {
    let result;
    switch (type) {
      case 'site':
        result = await prisma.site.updateMany({ where: { id, organization_id: orgId }, data: { name: body.name, code: body.code } });
        break;
      case 'plant':
        result = await prisma.plant.updateMany({ where: { id, organization_id: orgId }, data: { name: body.name, code: body.code } });
        break;
      case 'unit':
        result = await prisma.unit.updateMany({ where: { id, organization_id: orgId }, data: { name: body.name, code: body.code } });
        break;
      case 'system':
        result = await prisma.system.updateMany({ where: { id, organization_id: orgId }, data: { name: body.name, code: body.code } });
        break;
      case 'asset':
        result = await prisma.asset.updateMany({ 
          where: { id, organization_id: orgId }, 
          data: { tag_number: body.tag_number, name: body.name, asset_type: body.asset_type } 
        });
        break;
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ type: string, id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const orgId = (session.user as any).organization_id;
  const { type, id } = await params;

  try {
    switch (type) {
      case 'site':
        await prisma.site.updateMany({ where: { id, organization_id: orgId }, data: { deleted_at: new Date() } });
        break;
      case 'plant':
        await prisma.plant.updateMany({ where: { id, organization_id: orgId }, data: { deleted_at: new Date() } });
        break;
      case 'unit':
        await prisma.unit.updateMany({ where: { id, organization_id: orgId }, data: { deleted_at: new Date() } });
        break;
      case 'system':
        await prisma.system.updateMany({ where: { id, organization_id: orgId }, data: { deleted_at: new Date() } });
        break;
      case 'asset':
        await prisma.asset.updateMany({ where: { id, organization_id: orgId }, data: { deleted_at: new Date() } });
        break;
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
