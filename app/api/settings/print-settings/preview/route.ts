import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PdfService } from '@/modules/Workpack/Services/PdfService';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = (session.user as { organization_id?: string }).organization_id;
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 });

  try {
    const { prisma } = await import('@/lib/prisma');
    const workpack = await prisma.workpack.findFirst({
        where: { organization_id: orgId },
      select: { id: true },
    });
    if (!workpack?.id) {
      return NextResponse.json(
        { error: 'No workpack found to generate preview. Create a workpack first.' },
        { status: 404 }
      );
    }
    const pdf = await PdfService.generateWorkpackPdf(workpack.id, orgId);
    const blob = new Blob([pdf as BlobPart], { type: 'application/pdf' });
    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="print-settings-preview.pdf"',
      },
    });
  } catch (err: unknown) {
    console.error('[print-settings preview]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Preview failed' },
      { status: 500 }
    );
  }
}
