import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sanitiseFilename } from '@/lib/utils/filename';
import { PdfService } from '@/modules/Workpack/Services/PdfService';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organization_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const includeAttachments = searchParams.get('attachments') !== 'false';
    const orgId = session.user.organization_id;

    const workpack = await prisma.workpack.findFirst({
        where: { id, organization_id: orgId },
        select: { workpack_number: true, title: true },
    });
    const rawFilename = workpack
        ? `${workpack.workpack_number ?? id} — ${workpack.title ?? 'workpack'}.pdf`
        : `workpack-${id}.pdf`;
    const filename = sanitiseFilename(rawFilename);
    const encodedFilename = encodeURIComponent(
        workpack
            ? `${workpack.workpack_number ?? id} — ${workpack.title ?? 'workpack'}.pdf`
            : `workpack-${id}.pdf`
    );

    const buildHeaders = (buffer: Buffer, warning?: string): Record<string, string> => {
        const headers: Record<string, string> = {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
            'Content-Length': String(buffer.length),
        };
        if (warning) headers['X-Warning'] = warning;
        return headers;
    };

    try {
        let pdfBuffer: Buffer;
        let warning: string | undefined;

        if (includeAttachments) {
            const result = await PdfService.generateMergedPdf(id, orgId);
            const buf = result.buffer;
            pdfBuffer = Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer);
            warning = result.warning;
        } else {
            const pdf = await PdfService.generateWorkpackPdf(id, orgId);
            const raw = pdf as Buffer | { buffer: Buffer };
            pdfBuffer = Buffer.isBuffer(raw) ? raw : raw.buffer;
        }

        return new NextResponse(new Uint8Array(pdfBuffer), { headers: buildHeaders(pdfBuffer, warning) });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';

        if (message.toLowerCase().includes('timeout')) {
            try {
                const pdf = await PdfService.generateWorkpackPdf(id, orgId);
                const raw = pdf as Buffer | { buffer: Buffer };
                const fallbackBuffer = Buffer.isBuffer(raw) ? raw : raw.buffer;
                return new NextResponse(new Uint8Array(fallbackBuffer), {
                    headers: buildHeaders(
                        fallbackBuffer,
                        'Attachments excluded due to timeout'
                    ),
                });
            } catch (fallbackErr) {
                return NextResponse.json(
                    { error: 'PDF generation failed. Please try again.' },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json({ error: message }, { status: 500 });
    }
}
