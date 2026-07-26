import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';
import path from 'path';

export async function GET(req: Request) {
  const { session, error } = await guardApi('documents.view');
  if (error) return error;
  const { orgId } = orgScope(session);

  const url       = new URL(req.url);
  const eventId   = url.searchParams.get('eventId');
  const category  = url.searchParams.get('category');
  const orgLib    = url.searchParams.get('orgLibrary') === 'true';
  const q         = url.searchParams.get('q');

  const where: any = { org_id: orgId };
  if (eventId)  where.event_id        = eventId;
  if (category) where.category        = category;
  if (orgLib)   where.is_org_library  = true;

  if (q) {
    where.OR = [
      { title:           { contains: q, mode: 'insensitive' } },
      { original_name:   { contains: q, mode: 'insensitive' } },
      { description:     { contains: q, mode: 'insensitive' } },
      { ai_text:         { contains: q, mode: 'insensitive' } },
      { document_number: { contains: q, mode: 'insensitive' } },
    ];
  }

  const docs = await prisma.docLibrary.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: 100,
  });

  return NextResponse.json(docs);
}

export async function POST(req: Request) {
  const { session, error } = await guardApi('documents.upload');
  if (error) return error;
  const user = session!.user as any;
  const { orgId } = orgScope(session);

  // Check upload permission — Super Admin and Planner only
  const role = (user.role ?? '').toUpperCase();
  const canUpload = user.is_super_admin || role === 'SUPER_ADMIN' || role === 'PLANNER' || role === 'ADMIN';
  if (!canUpload) {
    return NextResponse.json({ error: 'Only Super Admin and Planner can upload documents' }, { status: 403 });
  }

  const formData   = await req.formData();
  const file       = formData.get('file')          as File | null;
  const title      = formData.get('title')         as string ?? '';
  const description= formData.get('description')   as string ?? '';
  const category   = formData.get('category')      as string ?? 'General';
  const revision   = formData.get('revision')      as string ?? '';
  const docNumber  = formData.get('document_number') as string ?? '';
  const eventId    = formData.get('event_id')      as string ?? '';
  const equipTags  = formData.get('equipment_tags') as string ?? '';
  const isOrgLib   = formData.get('is_org_library') === 'true';

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const ALLOWED = [
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  ];
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'File type not supported. Use PDF, Excel, Word or images.' }, { status: 400 });
  }
  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large. Maximum 50MB.' }, { status: 400 });
  }

  // SECURITY: files are stored OUTSIDE public/ so they are never served
  // statically. Access goes exclusively through the authenticated, org-scoped
  // /api/documents/[id]/download route.
  const dateStr  = new Date().toISOString().split('T')[0];
  const dir      = path.join(process.cwd(), 'uploads', 'doc-library', orgId, dateStr);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });

  const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const filePath = path.join(dir, filename);

  const docId       = randomUUID();
  const downloadUrl = `/api/documents/${docId}/download`;

  await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

  const doc = await prisma.docLibrary.create({
    data: {
      id:               docId,
      org_id:           orgId,
      event_id:         eventId || null,
      title:            title || file.name,
      description:      description || null,
      category,
      revision:         revision || null,
      document_number:  docNumber || null,
      equipment_tags:   equipTags ? equipTags.split(',').map(t => t.trim()).filter(Boolean) : [],
      filename,
      original_name:    file.name,
      storage_path:     filePath,
      public_url:       downloadUrl,
      file_size:        file.size,
      mime_type:        file.type,
      is_org_library:   isOrgLib,
      uploaded_by:      user.id,
      uploaded_by_name: user.name ?? user.email,
      updated_at:       new Date(),
    },
  });

  // Trigger AI indexing for PDFs in background (don't await)
  if (file.type === 'application/pdf') {
    indexPdfWithAI(doc.id, filePath, orgId).catch(console.error);
  }

  return NextResponse.json(doc, { status: 201 });
}

// Background AI indexing
async function indexPdfWithAI(docId: string, filePath: string, orgId: string) {
  try {
    const { loadProviderForJob } = await import('@/services/ai/ProviderLoader');
    const { generateSyorityAI } = await import('@/lib/ai/universalAiClient');
    const { extractPdfText }   = await import('@/lib/ai/aiHelpers');

    const aiConfig = await loadProviderForJob(orgId, 'workpack_generation');

    const pdfText = await extractPdfText(filePath);
    if (!pdfText || pdfText.length < 10) {
        console.warn(`[indexPdfWithAI] No text extracted from ${filePath}`);
        return;
    }

    const prompt = `Extract all text content from this document. Also provide a 2-3 sentence summary at the start.

    Format:
    SUMMARY: [summary]
    CONTENT: [full extracted text]

    Document text:
    ${pdfText.substring(0, 30000)}`;

    const results = await generateSyorityAI(
      {
        modelIdentifier: aiConfig.model,
        apiKey: aiConfig.apiKey,
        maxTokens: 4000,
      },
      prompt
    );

    const response = String(results);

    const summaryMatch = response.match(/SUMMARY:([\s\S]*?)(?:CONTENT:|$)/);
    const contentMatch = response.match(/CONTENT:([\s\S]*)/);

    await prisma.docLibrary.update({
      where: { id: docId },
      data: {
        ai_summary: summaryMatch?.[1]?.trim() ?? null,
        ai_text:    contentMatch?.[1]?.trim() ?? response,
        ai_indexed: true,
        updated_at: new Date(),
      },
    });
  } catch (err) {
    console.error('[DocLibrary] AI indexing failed:', err);
  }
}
