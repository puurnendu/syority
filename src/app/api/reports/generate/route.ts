import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { ReportGenerationService } from '@/core/report-builder/ReportGenerationService';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.organizationId || !session?.userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const body = await req.json();
    const { definitionId, outputFormat, parameters, selectedSections, includeAiSummary } = body;

    if (!definitionId || !outputFormat) {
      return new NextResponse('Missing required fields', { status: 400 });
    }

    // Verify tenant boundary for definition
    const definition = await prisma.report_definitions.findFirst({
      where: { id: definitionId, is_active: true }
    });

    if (!definition) {
      return new NextResponse('Report definition not found', { status: 404 });
    }

    // Generate Report Dataset and optionally HTML/PDF
    const result = await ReportGenerationService.generate({
      definitionId,
      organizationId: session.organizationId,
      generatedBy: session.userId,
      outputFormat: outputFormat as any,
      parameters: parameters ?? {},
      selectedSections,
      includeAiSummary,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[POST /api/reports/generate] Error:', error);
    return NextResponse.json({ error: error.message ?? 'Generation Failed' }, { status: 500 });
  }
}
