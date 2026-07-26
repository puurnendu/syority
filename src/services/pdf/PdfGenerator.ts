import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function generateShiftReportPdf(
  orgName: string,
  unitName: string,
  shiftType: string,
  dateLabel: string,
  reportText: string,
  completed: number,
  overdue: number,
  inProgress: number
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  let page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  const drawText = (text: string, f: any, size: number, color = rgb(0, 0, 0), align: 'left' | 'center' = 'left') => {
    const textWidth = f.widthOfTextAtSize(text, size);
    const x = align === 'center' ? (width - textWidth) / 2 : margin;
    page.drawText(text, { x, y, size, font: f, color });
    y -= size * 1.5;
  };

  // Header
  drawText(`${orgName.toUpperCase()} — SHIFT REPORT`, boldFont, 16, rgb(0.1, 0.2, 0.4), 'center');
  y -= 10;
  drawText(`Unit: ${unitName}`, boldFont, 12);
  drawText(`Shift: ${shiftType.toUpperCase()} | Date: ${dateLabel}`, font, 10, rgb(0.3, 0.3, 0.3));
  y -= 20;

  // Stats
  drawText(`COMPLETION METRICS`, boldFont, 12);
  y -= 5;
  drawText(`Activities Completed: ${completed}`, font, 10, rgb(0, 0.5, 0));
  drawText(`Activities Overdue: ${overdue}`, font, 10, rgb(0.8, 0, 0));
  drawText(`Activities In Progress: ${inProgress}`, font, 10, rgb(0, 0, 0.8));
  y -= 20;

  // Content
  drawText(`DETAILED SHIFT SUMMARY`, boldFont, 12);
  y -= 10;

  // Word wrap logic
  const maxLineWidth = width - margin * 2;
  const lines = reportText.split('\n');
  const size = 10;

  for (const paragraph of lines) {
    if (paragraph.trim() === '') {
      y -= size;
      continue;
    }
    
    const words = paragraph.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, size);

      if (testWidth > maxLineWidth && currentLine !== '') {
        if (y < margin + size) {
          page = pdfDoc.addPage([595.28, 841.89]);
          y = height - margin;
        }
        page.drawText(currentLine, { x: margin, y, size, font });
        y -= size * 1.3;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      if (y < margin + size) {
        page = pdfDoc.addPage([595.28, 841.89]);
        y = height - margin;
      }
      page.drawText(currentLine, { x: margin, y, size, font });
      y -= size * 1.3;
    }
  }

  // Footer
  y -= 20;
  if (y < margin) {
    page = pdfDoc.addPage([595.28, 841.89]);
    y = height - margin;
  }
  drawText('Generated automatically by SYORITY AI.', font, 8, rgb(0.5, 0.5, 0.5), 'center');

  return pdfDoc.save();
}
