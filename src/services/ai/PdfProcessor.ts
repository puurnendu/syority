/**
 * PdfProcessor — server-side PDF utilities
 * Uses pdf-lib for page extraction
 * Uses pdfjs-dist (legacy Node build) + canvas
 * for rendering pages as images for Vision AI
 */

import { PDFDocument } from 'pdf-lib';
import { createCanvas } from 'canvas';
import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

// pdfjs Node legacy build — must use legacy build for Node.js (no DOM)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

// Disable pdfjs worker in Node environment
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

// ── Types ─────────────────────────────────────────

export type PageRange = {
    label: string;
    from: number;
    to: number;
};

export type RenderedPage = {
    page_number: number;
    image_base64: string;
    width: number;
    height: number;
};

// ── Extract page range as sub-PDF ─────────────────

export async function extractPageRange(
    sourcePath: string,
    fromPage: number,
    toPage: number,
    outputPath: string
): Promise<void> {
    const sourceBytes = await readFile(sourcePath);
    const sourcePdf = await PDFDocument.load(sourceBytes);
    const pageCount = sourcePdf.getPageCount();

    const safeFrom = Math.max(1, fromPage);
    const safeTo = Math.min(pageCount, toPage);

    if (safeFrom > safeTo) {
        throw new Error(
            `Page range ${fromPage}–${toPage} invalid (document has ${pageCount} pages)`
        );
    }

    const subPdf = await PDFDocument.create();
    const indices = Array.from(
        { length: safeTo - safeFrom + 1 },
        (_, i) => safeFrom - 1 + i
    );
    const copied = await subPdf.copyPages(sourcePdf, indices);
    copied.forEach((p) => subPdf.addPage(p));

    const bytes = await subPdf.save();
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, bytes);
}

// ── Render pages as images ─────────────────────────

export async function renderPagesAsImages(
    sourcePath: string,
    pageNumbers: number[],
    scale = 2.0
): Promise<RenderedPage[]> {
    const data = await readFile(sourcePath);
    const loadTask = pdfjsLib.getDocument({
        data: new Uint8Array(data),
        useSystemFonts: true,
    });
    const pdf = await loadTask.promise;

    const results: RenderedPage[] = [];

    for (const pageNum of pageNumbers) {
        if (pageNum < 1 || pageNum > pdf.numPages) continue;

        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });

        const canvas = createCanvas(
            Math.floor(viewport.width),
            Math.floor(viewport.height)
        );
        const context = canvas.getContext('2d');

        await page.render({
            canvasContext: context as unknown as CanvasRenderingContext2D,
            viewport,
        }).promise;

        results.push({
            page_number: pageNum,
            image_base64: canvas.toBuffer('image/png').toString('base64'),
            width: Math.floor(viewport.width),
            height: Math.floor(viewport.height),
        });
    }

    return results;
}

// ── Get page count ─────────────────────────────────

export async function getPdfPageCount(sourcePath: string): Promise<number> {
    const sourceBytes = await readFile(sourcePath);
    const pdf = await PDFDocument.load(sourceBytes);
    return pdf.getPageCount();
}

// ── Convert base64-encoded PDF to page images ────────

/**
 * convertPdfBase64ToPageImages
 *
 * Accepts a raw base64 string (no data-URL prefix) of a PDF file,
 * decodes it to a temp file, renders each page as a high-resolution PNG
 * using the EXISTING renderPagesAsImages(), and returns an array of
 * VisionImage-compatible objects ready for callVisionAI().
 *
 * Existing functions renderPagesAsImages() and getPdfPageCount() are
 * called but NOT modified.
 *
 * @param pdfBase64  Base64-encoded PDF content (no data-URL prefix)
 * @param options.maxPages  Cap on pages to render (default: 5)
 * @param options.scale     Rendering scale factor — 3.0 ≈ 300 DPI (default: 3.0)
 */
export async function convertPdfBase64ToPageImages(
    pdfBase64: string,
    options: { maxPages?: number; scale?: number } = {}
): Promise<{ base64: string; mimeType: 'image/png' }[]> {
    const { maxPages = 5, scale = 3.0 } = options;

    if (!pdfBase64 || pdfBase64.trim() === '') {
        throw new Error('[PDF] Received empty PDF data.');
    }

    // Decode base64 → Buffer → temp file
    const buffer = Buffer.from(pdfBase64, 'base64');
    const tmpPath = join(tmpdir(), `joint-pdf-${randomUUID()}.pdf`);
    await writeFile(tmpPath, buffer);
    console.log(`[PDF] Temp file written: ${tmpPath} (${buffer.length} bytes)`);

    let pageCount: number;
    try {
        pageCount = await getPdfPageCount(tmpPath);
    } catch (err) {
        await unlink(tmpPath).catch(() => {});
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`[PDF] Could not open PDF — corrupted or unsupported format. Detail: ${msg}`);
    }

    if (pageCount === 0) {
        await unlink(tmpPath).catch(() => {});
        throw new Error('[PDF] PDF has no pages.');
    }

    const pagesToRender = Array.from(
        { length: Math.min(pageCount, maxPages) },
        (_, i) => i + 1
    );
    console.log(`[PDF] Rendering ${pagesToRender.length} of ${pageCount} page(s) at scale ${scale}`);

    let rendered: RenderedPage[];
    try {
        rendered = await renderPagesAsImages(tmpPath, pagesToRender, scale);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`[PDF] Page rendering failed: ${msg}`);
    } finally {
        // Always remove temp file regardless of success/failure
        await unlink(tmpPath).catch((e) =>
            console.warn(`[PDF] Failed to remove temp file ${tmpPath}:`, e)
        );
    }

    if (rendered.length === 0) {
        throw new Error('[PDF] PDF rendered 0 usable pages. The file may be blank or image-locked.');
    }

    console.log(`[PDF] Successfully rendered ${rendered.length} page(s) as PNG images.`);
    return rendered.map((p) => ({
        base64: p.image_base64,
        mimeType: 'image/png' as const,
    }));
}

// ── Save uploaded PDF + return storage path ────────

export async function savePdfUpload(
    file: File,
    uploadDir: string
): Promise<{ storagePath: string; filename: string }> {
    const uuid = randomUUID();
    const filename = `${uuid}.pdf`;
    const dir = join(process.cwd(), uploadDir);
    await mkdir(dir, { recursive: true });
    const fullPath = join(dir, filename);
    await writeFile(fullPath, Buffer.from(await file.arrayBuffer()));
    return { storagePath: fullPath, filename };
}
