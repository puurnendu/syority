import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.organizationId) return new NextResponse('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get('category');
  
  const where: any = { is_active: true };
  if (categoryId) where.category_id = categoryId;

  try {
    const definitions = await prisma.report_definitions.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(definitions);
  } catch (error: any) {
    console.error('[GET /api/reports/definitions] Error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
