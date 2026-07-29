import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { PlantDocumentService } from '@/core/digital-plant';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { session, error } = await guardApi('documents.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { id } = await params;

  const { searchParams } = new URL(req.url);
  const result = await PlantDocumentService.listDocuments({
    organizationId: orgId,
    projectId: id,
    documentType: searchParams.get('document_type') ?? undefined,
    discipline: searchParams.get('discipline') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    search: searchParams.get('search') ?? undefined,
    page: parseInt(searchParams.get('page') ?? '1', 10),
    pageSize: parseInt(searchParams.get('page_size') ?? '50', 10),
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { session, error } = await guardApi('documents.upload');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);
  const { id } = await params;

  const formData = await req.formData();
  const file = formData.get('file') as File;
  if (!file) return NextResponse.json({ error: 'File is required' }, { status: 400 });

  const doc = await PlantDocumentService.uploadDocument({
    organizationId: orgId,
    projectId: id,
    file,
    documentType: (formData.get('document_type') as string) || 'Other',
    title: (formData.get('title') as string) || file.name,
    drawingNumber: (formData.get('drawing_number') as string) || undefined,
    revision: (formData.get('revision') as string) || undefined,
    issueDate: (formData.get('issue_date') as string) || undefined,
    discipline: (formData.get('discipline') as string) || undefined,
    unitId: (formData.get('unit_id') as string) || undefined,
    systemId: (formData.get('system_id') as string) || undefined,
    uploadedBy: userId,
  });

  return NextResponse.json(doc, { status: 201 });
}
