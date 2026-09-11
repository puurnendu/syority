import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { extractFromPAndId } from '@/services/ai/PAndIdExtractor';
import { getPdfPageCount } from '@/services/ai/PdfProcessor';

function parsePageNumbers(raw: string, maxPage: number): number[] {
  const pages = new Set<number>();
  for (const part of raw.split(/[,;\s]+/).filter(Boolean)) {
    if (part.includes('-')) {
      const [fromStr, toStr] = part.split('-');
      const from = Math.max(1, parseInt(fromStr, 10));
      const to = Math.min(maxPage, parseInt(toStr, 10));
      if (!Number.isNaN(from) && !Number.isNaN(to)) {
        for (let p = from; p <= to; p++) pages.add(p);
      }
    } else {
      const p = parseInt(part, 10);
      if (!Number.isNaN(p) && p >= 1 && p <= maxPage) pages.add(p);
    }
  }
  return [...pages].sort((a, b) => a - b);
}

export async function POST(req: NextRequest) {
  const { session, error } = await guardApi('masterdata.edit');
  if (error) return error;
  const { orgId, userId } = orgScope(session!);

  try {
    const formData = await req.formData();
    const tileFiles = formData.getAll('tiles').filter((f): f is File => f instanceof File && f.size > 0);
    const file = formData.get('file') as File | null;
    const unitId = (formData.get('unit_id') as string | null)?.trim() || '';
    const siteIdRaw = (formData.get('site_id') as string | null)?.trim() || '';
    const pagesRaw = (formData.get('page_numbers') as string | null)?.trim() || '';

    if (!file && tileFiles.length === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    const primaryFile = tileFiles.length > 0 ? tileFiles[0] : file!;
    const mimeType = primaryFile.type || 'application/pdf';

    const validateFile = (f: File) => {
      if (!allowed.includes(f.type) && !f.name.match(/\.(pdf|png|jpe?g|webp)$/i)) {
        return 'File must be PDF or image (PNG, JPEG, WebP)';
      }
      if (f.size > 10 * 1024 * 1024) return 'File too large. Maximum 10MB.';
      return null;
    };

    for (const f of tileFiles.length > 0 ? tileFiles : [file!]) {
      const err = validateFile(f);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const dir = join(process.cwd(), 'uploads', 'pid-extraction', orgId, dateStr);
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });

    const saveUpload = async (upload: File, suffix: string) => {
      const storedName = `${randomUUID()}${suffix}_${upload.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const storagePath = join(dir, storedName);
      await writeFile(storagePath, Buffer.from(await upload.arrayBuffer()));
      return storagePath;
    };

    let storagePaths: string[];
    let sourceFilename: string;

    if (tileFiles.length > 0) {
      storagePaths = [];
      for (let i = 0; i < tileFiles.length; i++) {
        storagePaths.push(await saveUpload(tileFiles[i], `_tile${i + 1}`));
      }
      sourceFilename = file?.name
        ? `${file.name} (${tileFiles.length} tiles)`
        : `pid-tiles (${tileFiles.length})`;
    } else {
      storagePaths = [await saveUpload(file!, '')];
      sourceFilename = file!.name;
    }

    let resolvedSiteId = siteIdRaw || null;
    if (unitId && !resolvedSiteId) {
      const unit = await prisma.unit.findFirst({
        where: { id: unitId, organization_id: orgId, deleted_at: null },
        select: { site_id: true },
      });
      resolvedSiteId = unit?.site_id ?? null;
    }
    if (!resolvedSiteId) {
      const site = await prisma.site.findFirst({
        where: { organization_id: orgId, deleted_at: null },
        select: { id: true },
        orderBy: { name: 'asc' },
      });
      resolvedSiteId = site?.id ?? null;
    }
    if (!resolvedSiteId) {
      return NextResponse.json({ error: 'No site found for this organisation' }, { status: 400 });
    }

    const isPdf =
      tileFiles.length === 0 &&
      (mimeType === 'application/pdf' || (file?.name.toLowerCase().endsWith('.pdf') ?? false));
    let pageNumbers = [1];
    if (isPdf) {
      const pageCount = await getPdfPageCount(storagePaths[0]);
      if (pagesRaw) {
        pageNumbers = parsePageNumbers(pagesRaw, pageCount);
      } else {
        pageNumbers = Array.from({ length: Math.min(pageCount, 5) }, (_, i) => i + 1);
      }
      if (pageNumbers.length === 0) {
        return NextResponse.json({ error: 'No valid page numbers in range' }, { status: 400 });
      }
    }

    const sourceDocumentId = randomUUID();
    const extractionMime = tileFiles.length > 0 ? 'image/png' : mimeType;
    const result = await extractFromPAndId(
      orgId,
      resolvedSiteId,
      unitId,
      sourceDocumentId,
      storagePaths.length === 1 ? storagePaths[0] : storagePaths,
      pageNumbers,
      userId,
      extractionMime
    );

    return NextResponse.json({
      ...result,
      source_filename: sourceFilename,
      pages_processed: pageNumbers,
      tiles_processed: tileFiles.length > 0 ? tileFiles.length : undefined,
    });
  } catch (err: unknown) {
    console.error('P&ID Extraction Error:', err);
    const message = err instanceof Error ? err.message : 'Extraction failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
