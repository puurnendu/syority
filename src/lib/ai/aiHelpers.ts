/**
 * AI Helpers
 * Provider-agnostic functions for PDF text extraction.
 * 
 * NOTE: JSON parsing and Vision-related context generation have been moved 
 * to '@/services/ai/VisionAiService' for centralization.
 */

import { readFile } from 'fs/promises';

/** Extract text from a PDF file using pdf-parse or fallback. */
export async function extractPdfText(filePath: string): Promise<string> {
    try {
        const pdfParse = await import('pdf-parse').catch(() => null);
        const pdfParseFn = pdfParse && (typeof (pdfParse as unknown as any).default === 'function' ? (pdfParse as unknown as any).default : null);

        if (pdfParseFn) {
            const buffer = await readFile(filePath);
            const data = await pdfParseFn(buffer);
            return (data as { text?: string }).text ?? '';
        }

        const buffer = await readFile(filePath);
        const text = buffer.toString('latin1');
        const readable = text.match(/[\x20-\x7E\n\r\t]{4,}/g) ?? [];
        return readable.join(' ');
    } catch (err) {
        console.warn(`[DocContext] Failed to read ${filePath}:`, err);
        return '';
    }
}
