import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardApi } from '@/lib/apiGuard';
import { generateSyorityAI } from '@/lib/ai/universalAiClient';
import { loadProviderForJob } from '@/services/ai/ProviderLoader';

export async function POST(req: Request) {
  const { session, error } = await guardApi('documents.view');
  if (error) return error;
  const user    = session!.user as any;
  const { query } = await req.json();

  if (!query?.trim()) return NextResponse.json({ results: [] });

  // First — keyword search across all indexed docs
  const docs = await prisma.docLibrary.findMany({
    where: {
      org_id: user.organization_id,
      OR: [
        { title:           { contains: query, mode: 'insensitive' } },
        { ai_text:         { contains: query, mode: 'insensitive' } },
        { ai_summary:      { contains: query, mode: 'insensitive' } },
        { document_number: { contains: query, mode: 'insensitive' } },
        { equipment_tags:  { has: query } },
      ],
    },
    take: 20,
    orderBy: { created_at: 'desc' },
  });

  // If we have AI-indexed docs, ask AI to rank them by relevance
  if (docs.length > 0 && docs.some(d => d.ai_summary)) {
    try {
      const docList = docs.map((d, i) =>
        `[${i}] ${d.title} | ${d.category} | ${d.ai_summary?.slice(0, 200) ?? ''}`
      ).join('\n');

      const aiConfigData = await loadProviderForJob(user.organization_id, 'workpack_generation');
      const aiConfig = {
          modelIdentifier: aiConfigData.model,
          apiKey: aiConfigData.apiKey,
          organizationId: user.organization_id,
          maxTokens: 200
      };

      const prompt = `Search query: "${query}"\n\nDocuments:\n${docList}\n\nReturn ONLY a JSON array of the most relevant document indices in order of relevance. Example: [2, 0, 4]. Return at most 10 indices.`;

      // generateSyorityAI handles parsing internally and returns parsed JSON.
      const indices = await generateSyorityAI(aiConfig, prompt) as number[];

      if (indices.length > 0) {
        const ranked = indices.map(i => docs[i]).filter(Boolean);
        return NextResponse.json({ results: ranked, aiRanked: true });
      }
    } catch {}
  }

  return NextResponse.json({ results: docs, aiRanked: false });
}
