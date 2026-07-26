import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { callVisionAi } from '@/services/ai/VisionAiService';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const orgId = (session.user as any).organization_id;
  const userId = (session.user as any).id;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) throw new Error('No file provided');

    // Create PidExtractionJob record
    const job = await prisma.pidExtractionJob.create({
      data: {
        organization_id: orgId,
        user_id: userId,
        file_name: file.name,
        status: 'processing'
      }
    });

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const base64File = fileBuffer.toString('base64');
    const mimeType = file.type || 'application/pdf';

    const prompt = `
      You are an expert engineering AI. Analyze this P&ID (Piping and Instrumentation Diagram).
      Extract all equipment tags (e.g. E-101, P-201A), connected lines (e.g. 10"-CS-1001-A1A), and nozzles (e.g. N1, N2).
      Return ONLY a JSON object with this exact structure:
      {
        "equipment": [
          { "tag": "E-101", "name": "Heat Exchanger", "type": "Shell & Tube", "nozzles": ["N1", "N2"] }
        ],
        "lines": [
          { "lineNumber": "10-CS-1001", "size": "10", "spec": "A1A", "from": "E-101 (N1)", "to": "P-201A (Suc)" }
        ]
      }
    `;

    const extractionResult = await callVisionAi({
      organization_id: orgId,
      prompt,
      images: [{ base64: base64File, mimeType }],
    });
    let jsonData;
    try {
      const jsonStr = extractionResult.content.replace(/```json/g, '').replace(/```/g, '').trim();
      jsonData = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error('AI returned invalid JSON');
    }

    const updatedJob = await prisma.pidExtractionJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        extracted_data: jsonData
      }
    });

    return NextResponse.json(updatedJob);
  } catch (error: any) {
    console.error('P&ID Extraction Error:', error);
    return NextResponse.json({ error: error.message || 'Extraction failed' }, { status: 500 });
  }
}
