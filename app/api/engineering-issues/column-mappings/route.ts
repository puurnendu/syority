import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { session, error } = await guardApi('asset.view');
  if (error) return error;
  const { orgId } = orgScope(session!);

  const { searchParams } = new URL(req.url);
  const sourceType = searchParams.get('source_type');

  const where: any = { organization_id: orgId };
  if (sourceType) where.source_type = sourceType;

  const mappings = await prisma.issueColumnMapping.findMany({
    where,
    orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
    take: 50,
  });

  return NextResponse.json({ data: mappings });
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('asset.manage');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);

  const body = await req.json();
  if (!body.name || !body.source_type || !body.mappings) {
    return NextResponse.json({ error: 'name, source_type, and mappings are required' }, { status: 400 });
  }

  const { randomUUID } = await import('crypto');
  const mapping = await prisma.issueColumnMapping.create({
    data: {
      id: randomUUID(),
      organization_id: orgId,
      name: body.name,
      source_type: body.source_type,
      mappings: body.mappings,
      is_default: body.is_default || false,
      created_by: userId,
    },
  });

  return NextResponse.json(mapping, { status: 201 });
}
