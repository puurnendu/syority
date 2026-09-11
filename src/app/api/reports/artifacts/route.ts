import { NextResponse } from 'next/server';
import { ArtifactService } from '@/core/report-engine/ArtifactService';
import { getSession } from '@/lib/auth';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.organizationId) return new NextResponse('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const definitionId = searchParams.get('definitionId') || undefined;

  try {
    // Tenant boundary secured via organizationId parameter
    const artifacts = await ArtifactService.list(session.organizationId, {
      page,
      definitionId,
    });

    return NextResponse.json(artifacts);
  } catch (error: any) {
    console.error('[GET /api/reports/artifacts] Error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
