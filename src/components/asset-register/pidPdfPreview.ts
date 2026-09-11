'use client';

/** Client-side PDF page render for P&ID crop workflow (pdfjs-dist 2.x). */

export type PdfPageRender = {
  blob: Blob;
  width: number;
  height: number;
  pageCount: number;
};

export async function getPdfPageCount(file: File): Promise<number> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
  const lib = pdfjs as typeof import('pdfjs-dist/legacy/build/pdf.js');
  lib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${lib.version}/pdf.worker.min.js`;
  const data = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data }).promise;
  return pdf.numPages;
}

export async function renderPdfPageToBlob(
  file: File,
  pageNumber: number,
  scale = 1.5
): Promise<PdfPageRender> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
  const lib = pdfjs as typeof import('pdfjs-dist/legacy/build/pdf.js');
  lib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${lib.version}/pdf.worker.min.js`;

  const data = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data }).promise;
  const pageNum = Math.min(Math.max(1, pageNumber), pdf.numPages);
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  await page.render({ canvasContext: ctx, viewport }).promise;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to render PDF page'))), 'image/png', 0.92);
  });

  return {
    blob,
    width: canvas.width,
    height: canvas.height,
    pageCount: pdf.numPages,
  };
}

export function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load rendered page'));
    };
    img.src = url;
  });
}
