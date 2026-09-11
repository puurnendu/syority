import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string; constraintId: string }> }) {
    const { session, error } = await guardApi('workpacks.edit');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { id, constraintId } = await context.params;

    const constraint = await prisma.constraintLog.findFirst({
        where: { id: constraintId, workpack_id: id, organization_id: orgId, deleted_at: null },
        select: { id: true },
    });
    if (!constraint) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const formData = await req.formData().catch(() => null);
    const file = formData?.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    if (file.type !== 'application/pdf') return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });

    const uploadDir = join(process.cwd(), 'uploads', 'constraints');
    await mkdir(uploadDir, { recursive: true });
    const filename = `${randomUUID()}.pdf`;
    const filepath = join(uploadDir, filename);
    await writeFile(filepath, Buffer.from(await file.arrayBuffer()));

    const attachment = await prisma.constraint_attachments.create({
        data: {
            constraint_id: constraintId,
            filename: file.name,
            file_path: '/uploads/constraints/' + filename,
            file_size: file.size,
            mime_type: 'application/pdf',
            uploaded_by: (session!.user as any).email ?? 'unknown',
        },
    });
    return NextResponse.json(attachment, { status: 201 });
}
